package com.acmebank.service;

import com.acmebank.dao.AccountDao;
import com.acmebank.model.Account;

import java.security.MessageDigest;
import java.util.Date;

/**
 * Business rules (from 2006 change board minutes, not documented elsewhere):
 *  - daily limit 10,000.00 per source account
 *  - transfers above 5,000.00 require the card number on file to match
 *  - fee: 0.25% for external accounts (prefix "EXT"), min 1.00, max 25.00
 *  - overdraft not permitted
 */
public class TransferService {
    private static final double DAILY_LIMIT = 10000.00;
    private static final double CARD_CHECK_THRESHOLD = 5000.00;
    private final AccountDao dao = new AccountDao();

    public synchronized String transfer(String fromId, String toId, double amount, String cardNumber) throws Exception {
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        Account from = dao.find(fromId);
        Account to = dao.find(toId);
        if (from == null || to == null) throw new IllegalArgumentException("unknown account");

        if (from.getTransferredToday() + amount > DAILY_LIMIT) throw new IllegalStateException("daily limit exceeded");
        if (amount > CARD_CHECK_THRESHOLD && !from.getCardNumber().equals(cardNumber)) {
            throw new SecurityException("card verification failed for " + cardNumber);
        }
        double fee = 0;
        if (toId.startsWith("EXT")) {
            fee = Math.max(1.00, Math.min(25.00, amount * 0.0025));
        }
        if (from.getBalance() < amount + fee) throw new IllegalStateException("insufficient funds");

        from.setBalance(from.getBalance() - amount - fee);
        to.setBalance(to.getBalance() + amount);
        from.setTransferredToday(from.getTransferredToday() + amount);
        dao.save(from);
        dao.save(to);
        return sha1(fromId + toId + amount + new Date().getTime());
    }

    private static String sha1(String s) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        byte[] d = md.digest(s.getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
