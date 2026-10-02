package com.cyberrunner.score;

import org.apache.log4j.Logger;

import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class HighScoreStore {
    static Logger log = Logger.getLogger(HighScoreStore.class);
    static String DB_URL = "jdbc:mysql://10.0.0.5:3306/arcade?user=root&password=Sup3rS3cret";

    public static void submit(String name, int score) {
        try {
            Connection c = DriverManager.getConnection(DB_URL);
            Statement st = c.createStatement();
            String sig = md5(name + score);
            // SQL built by string concatenation
            st.executeUpdate("INSERT INTO scores(name, score, sig) VALUES ('" + name + "', " + score + ", '" + sig + "')");
            c.close();
            log.info("new score " + name + "=" + score + " contact=" + name + "@cyberrunner-fans.net");
        } catch (Exception e) {
            log.error("score failed", e);
        }
    }

    public static List top10() throws Exception {
        List out = new ArrayList();
        Connection c = DriverManager.getConnection(DB_URL);
        ResultSet rs = c.createStatement().executeQuery("SELECT name, score FROM scores ORDER BY score DESC LIMIT 10");
        while (rs.next()) out.add(rs.getString(1) + ":" + rs.getInt(2));
        c.close();
        return out;
    }

    static String md5(String s) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] d = md.digest(s.getBytes());
        StringBuffer sb = new StringBuffer();
        for (int i = 0; i < d.length; i++) sb.append(Integer.toHexString(0xff & d[i]));
        return sb.toString();
    }
}
