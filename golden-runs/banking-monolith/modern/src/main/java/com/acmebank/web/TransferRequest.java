package com.acmebank.web;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record TransferRequest(
        @NotBlank @Pattern(regexp = "^[A-Z0-9-]{3,34}$") String from,
        @NotBlank @Pattern(regexp = "^[A-Z0-9-]{3,34}$") String to,
        @NotNull @DecimalMin("0.01") @Digits(integer = 15, fraction = 2) BigDecimal amount,
        @Pattern(regexp = "^\\d{12,19}$") String cardNumber) {

    @Override
    public String toString() {
        return "TransferRequest[from=" + from + ", to=" + to + ", amount=" + amount + ", cardNumber=****]";
    }
}
