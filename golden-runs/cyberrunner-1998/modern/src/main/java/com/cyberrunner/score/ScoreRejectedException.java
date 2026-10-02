package com.cyberrunner.score;

public class ScoreRejectedException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public ScoreRejectedException(String message) {
        super(message);
    }
}
