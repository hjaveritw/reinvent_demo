package com.acmebank.model;

public class Account {
    private String id;
    private String ownerName;
    private String ssn;          // e.g. 078-05-1120 (test fixture)
    private String cardNumber;   // e.g. 4111111111111111 (test fixture)
    private double balance;
    private double transferredToday;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getSsn() { return ssn; }
    public void setSsn(String ssn) { this.ssn = ssn; }
    public String getCardNumber() { return cardNumber; }
    public void setCardNumber(String cardNumber) { this.cardNumber = cardNumber; }
    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }
    public double getTransferredToday() { return transferredToday; }
    public void setTransferredToday(double transferredToday) { this.transferredToday = transferredToday; }
}
