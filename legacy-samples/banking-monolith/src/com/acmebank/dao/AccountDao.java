package com.acmebank.dao;

import com.acmebank.model.Account;

import java.sql.*;

public class AccountDao {
    private static final String URL = "jdbc:oracle:thin:@db01.acmebank.local:1521:CORE";
    private static final String USER = "core_app";
    private static final String PASSWORD = "Winter2006!";

    public Account find(String id) throws SQLException {
        try (Connection c = DriverManager.getConnection(URL, USER, PASSWORD);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT * FROM accounts WHERE id = '" + id + "'")) {
            if (!rs.next()) return null;
            Account a = new Account();
            a.setId(rs.getString("id"));
            a.setOwnerName(rs.getString("owner_name"));
            a.setSsn(rs.getString("ssn"));
            a.setCardNumber(rs.getString("card_number"));
            a.setBalance(rs.getDouble("balance"));
            a.setTransferredToday(rs.getDouble("transferred_today"));
            return a;
        }
    }

    public void save(Account a) throws SQLException {
        try (Connection c = DriverManager.getConnection(URL, USER, PASSWORD);
             Statement st = c.createStatement()) {
            st.executeUpdate("UPDATE accounts SET balance=" + a.getBalance() + ", transferred_today="
                    + a.getTransferredToday() + " WHERE id='" + a.getId() + "'");
        }
    }
}
