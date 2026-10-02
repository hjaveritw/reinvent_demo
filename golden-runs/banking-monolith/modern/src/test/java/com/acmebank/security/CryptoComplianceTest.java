package com.acmebank.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CryptoComplianceTest {
    private final EncryptedStringConverter converter =
            new EncryptedStringConverter("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");

    @Test
    void aesGcmRoundTripAndRandomIv() {
        String a = converter.convertToDatabaseColumn("078-05-1120");
        String b = converter.convertToDatabaseColumn("078-05-1120");
        assertThat(a).isNotEqualTo(b).doesNotContain("078-05-1120");
        assertThat(converter.convertToEntityAttribute(a)).isEqualTo("078-05-1120");
    }

    @Test
    void panIsTokenizedNotStored() {
        String token = new CardTokenizer().tokenize("4111111111111111");
        assertThat(token).hasSize(64).doesNotContain("4111");
    }

    @Test
    void invalidLuhnIsRejected() {
        assertThatThrownBy(() -> new CardTokenizer().tokenize("4111111111111112"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
