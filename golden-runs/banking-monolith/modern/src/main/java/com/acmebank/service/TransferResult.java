package com.acmebank.service;

import java.math.BigDecimal;

public record TransferResult(String reference, BigDecimal amount, BigDecimal fee) {
}
