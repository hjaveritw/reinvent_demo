package com.cyberrunner.logging;

/** COMP-GDPR-02 helpers: mask identifiers before they can reach CloudWatch. */
public final class LogMasking {
    private LogMasking() {
    }

    public static String maskIp(String ip) {
        if (ip == null) {
            return null;
        }
        int idx = ip.lastIndexOf('.');
        return idx < 0 ? "***" : ip.substring(0, idx) + ".***";
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(email.indexOf('@'));
    }
}
