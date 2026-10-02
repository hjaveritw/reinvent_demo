package com.cyberrunner.net;

import jakarta.validation.constraints.Pattern;

/** Replaces legacy JOIN (0x01). Name is validated instead of trusted. */
public record JoinCommand(@Pattern(regexp = "^[A-Za-z0-9_-]{1,16}$") String name) {
}
