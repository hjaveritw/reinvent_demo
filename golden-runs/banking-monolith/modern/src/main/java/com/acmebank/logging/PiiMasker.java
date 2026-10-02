package com.acmebank.logging;

import java.util.regex.Pattern;

/** COMP-GDPR-02 / COMP-PCI-01: masks PANs, SSNs and IPs before anything is logged. */
public final class PiiMasker {
    private static final Pattern PAN = Pattern.compile("\\b(\\d{6})\\d{3,9}(\\d{4})\\b");
    private static final Pattern SSN = Pattern.compile("\\b\\d{3}-\\d{2}-(\\d{4})\\b");
    private static final Pattern IPV4 = Pattern.compile("\\b(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\.\\d{1,3}\\b");

    private PiiMasker() {
    }

    public static String mask(String input) {
        if (input == null) {
            return null;
        }
        String out = PAN.matcher(input).replaceAll("$1******$2");
        out = SSN.matcher(out).replaceAll("***-**-$1");
        return IPV4.matcher(out).replaceAll("$1.***");
    }
}
