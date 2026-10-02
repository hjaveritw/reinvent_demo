package com.cyberrunner.score;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;

import java.time.Instant;

@Entity
public class ScoreEntry {
    @Id
    @GeneratedValue
    private Long id;
    private String playerName;
    private int score;
    private String signature;
    private Instant createdAt;

    protected ScoreEntry() {
    }

    public ScoreEntry(String playerName, int score, String signature, Instant createdAt) {
        this.playerName = playerName;
        this.score = score;
        this.signature = signature;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getPlayerName() {
        return playerName;
    }

    public int getScore() {
        return score;
    }

    public String getSignature() {
        return signature;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
