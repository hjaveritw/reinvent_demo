package com.acmebank.model;

import com.acmebank.security.EncryptedStringConverter;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;

/** COMP-HIPAA-02: audited entity; COMP-HIPAA-01: sensitive columns encrypted at rest. */
@Entity
@EntityListeners(AuditingEntityListener.class)
public class Account {
    @Id
    private String id;

    @Convert(converter = EncryptedStringConverter.class)
    private String ownerName;

    @Convert(converter = EncryptedStringConverter.class)
    private String ssn;

    /** SHA-256 token of the PAN; the PAN itself is never persisted. */
    private String cardToken;

    @Column(precision = 19, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(precision = 19, scale = 2)
    private BigDecimal transferredToday = BigDecimal.ZERO;

    @Version
    private long version;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    protected Account() {
    }

    public Account(String id, String ownerName, String ssn, String cardToken, BigDecimal balance) {
        this.id = id;
        this.ownerName = ownerName;
        this.ssn = ssn;
        this.cardToken = cardToken;
        this.balance = balance;
    }

    public String getId() {
        return id;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public String getSsn() {
        return ssn;
    }

    public String getCardToken() {
        return cardToken;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public BigDecimal getTransferredToday() {
        return transferredToday;
    }

    public void debit(BigDecimal amount, BigDecimal fee) {
        this.balance = balance.subtract(amount).subtract(fee);
        this.transferredToday = transferredToday.add(amount);
    }

    public void credit(BigDecimal amount) {
        this.balance = balance.add(amount);
    }
}
