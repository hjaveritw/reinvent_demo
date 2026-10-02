package com.acmebank.service;

import com.acmebank.model.Account;
import com.acmebank.repository.AccountRepository;
import com.acmebank.security.CardTokenizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Parity with legacy TransferService business rules (RESS BR-01..BR-05). */
@SpringBootTest
class TransferServiceParityTest {
    private static final String TEST_PAN = "4111111111111111";

    @Autowired
    TransferService service;
    @Autowired
    AccountRepository repo;
    @Autowired
    CardTokenizer tokenizer;

    @BeforeEach
    void seed() {
        repo.deleteAll();
        repo.save(new Account("ACC-1", "Test Owner", "000-00-0000", tokenizer.tokenize(TEST_PAN), new BigDecimal("20000.00")));
        repo.save(new Account("ACC-2", "Other Owner", "000-00-0001", tokenizer.tokenize(TEST_PAN), new BigDecimal("0.00")));
        repo.save(new Account("EXT-9", "External", "000-00-0002", tokenizer.tokenize(TEST_PAN), new BigDecimal("0.00")));
    }

    @Test
    void internalTransferHasNoFee() {
        var r = service.transfer("ACC-1", "ACC-2", new BigDecimal("100.00"), null);
        assertThat(r.fee()).isEqualByComparingTo("0.00");
        assertThat(repo.findById("ACC-1").orElseThrow().getBalance()).isEqualByComparingTo("19900.00");
    }

    @Test
    void externalFeeIsQuarterPercentClampedToMinAndMax() {
        assertThat(TransferService.feeFor("EXT-9", new BigDecimal("100.00"))).isEqualByComparingTo("1.00");
        assertThat(TransferService.feeFor("EXT-9", new BigDecimal("2000.00"))).isEqualByComparingTo("5.00");
        assertThat(TransferService.feeFor("EXT-9", new BigDecimal("20000.00"))).isEqualByComparingTo("25.00");
    }

    @Test
    void dailyLimitOfTenThousandIsEnforced() {
        service.transfer("ACC-1", "ACC-2", new BigDecimal("4000.00"), null);
        service.transfer("ACC-1", "ACC-2", new BigDecimal("4000.00"), null);
        assertThatThrownBy(() -> service.transfer("ACC-1", "ACC-2", new BigDecimal("2000.01"), null))
                .hasMessage("daily limit exceeded");
    }

    @Test
    void cardVerificationRequiredAboveFiveThousand() {
        assertThatThrownBy(() -> service.transfer("ACC-1", "ACC-2", new BigDecimal("5000.01"), "4000000000000002"))
                .hasMessage("card verification failed");
        var ok = service.transfer("ACC-1", "ACC-2", new BigDecimal("5000.01"), TEST_PAN);
        assertThat(ok.reference()).isNotBlank();
    }

    @Test
    void overdraftIsRejected() {
        assertThatThrownBy(() -> service.transfer("ACC-2", "ACC-1", new BigDecimal("0.01"), null))
                .hasMessage("insufficient funds");
    }

    @Test
    void nonPositiveAmountsAreRejected() {
        assertThatThrownBy(() -> service.transfer("ACC-1", "ACC-2", BigDecimal.ZERO, null))
                .hasMessage("amount must be positive");
    }

    @Test
    void auditTimestampsArePopulated() {
        assertThat(repo.findById("ACC-1").orElseThrow()).extracting("createdAt").isNotNull();
    }
}
