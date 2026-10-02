package com.acmebank.logging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PiiMaskerTest {
    @Test
    void masksPanSsnAndIp() {
        String masked = PiiMasker.mask("card=4111111111111111 ssn=078-05-1120 ip=10.1.2.3");
        assertThat(masked).isEqualTo("card=411111******1111 ssn=***-**-1120 ip=10.1.2.***");
    }
}
