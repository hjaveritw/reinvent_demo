package com.acmebank.service;

import com.acmebank.model.Account;
import com.acmebank.repository.AccountRepository;
import com.acmebank.security.CardTokenizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/**
 * Business rules recovered by reverse engineering (RESS BR-01..BR-05):
 * daily limit 10,000.00; card verification above 5,000.00; 0.25% external fee clamped to [1.00, 25.00];
 * no overdraft. Money is BigDecimal (legacy used double).
 */
@Service
public class TransferService {
    static final BigDecimal DAILY_LIMIT = new BigDecimal("10000.00");
    static final BigDecimal CARD_CHECK_THRESHOLD = new BigDecimal("5000.00");
    static final BigDecimal EXTERNAL_FEE_RATE = new BigDecimal("0.0025");
    static final BigDecimal MIN_FEE = new BigDecimal("1.00");
    static final BigDecimal MAX_FEE = new BigDecimal("25.00");

    private final AccountRepository accounts;
    private final CardTokenizer tokenizer;

    public TransferService(AccountRepository accounts, CardTokenizer tokenizer) {
        this.accounts = accounts;
        this.tokenizer = tokenizer;
    }

    @Transactional
    public TransferResult transfer(String fromId, String toId, BigDecimal amount, String cardNumber) {
        if (amount == null || amount.signum() <= 0) {
            throw new TransferException("amount must be positive");
        }
        Account from = accounts.findById(fromId).orElseThrow(() -> new TransferException("unknown account"));
        Account to = accounts.findById(toId).orElseThrow(() -> new TransferException("unknown account"));

        if (from.getTransferredToday().add(amount).compareTo(DAILY_LIMIT) > 0) {
            throw new TransferException("daily limit exceeded");
        }
        if (amount.compareTo(CARD_CHECK_THRESHOLD) > 0) {
            String presented = cardNumber == null ? null : safeTokenize(cardNumber);
            if (presented == null || !presented.equals(from.getCardToken())) {
                // COMP-PCI-01: never echo the PAN back
                throw new TransferException("card verification failed");
            }
        }
        BigDecimal fee = feeFor(toId, amount);
        if (from.getBalance().compareTo(amount.add(fee)) < 0) {
            throw new TransferException("insufficient funds");
        }
        from.debit(amount, fee);
        to.credit(amount);
        accounts.save(from);
        accounts.save(to);
        return new TransferResult(UUID.randomUUID().toString(), amount, fee);
    }

    static BigDecimal feeFor(String toId, BigDecimal amount) {
        if (!toId.startsWith("EXT")) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN);
        }
        BigDecimal fee = amount.multiply(EXTERNAL_FEE_RATE).setScale(2, RoundingMode.HALF_EVEN);
        return fee.max(MIN_FEE).min(MAX_FEE);
    }

    private String safeTokenize(String pan) {
        try {
            return tokenizer.tokenize(pan);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
