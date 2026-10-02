package com.cyberrunner.score;

import com.cyberrunner.engine.GameEngine;
import com.cyberrunner.engine.PlayerSnapshot;
import com.cyberrunner.engine.PlayerState;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.List;

/**
 * Server-authoritative scoring. The legacy SCORE (0x03) packet let clients submit any score;
 * now only the engine's own score for a finished run can be recorded.
 */
@Service
public class ScoreService {
    private final GameEngine engine;
    private final ScoreRepository repository;
    private final Clock clock;

    public ScoreService(GameEngine engine, ScoreRepository repository, Clock clock) {
        this.engine = engine;
        this.repository = repository;
        this.clock = clock;
    }

    public ScoreEntry recordFinalScore(int playerId, String playerName) {
        if (playerName == null || !playerName.matches("^[A-Za-z0-9_-]{1,16}$")) {
            throw new ScoreRejectedException("invalid player name");
        }
        PlayerSnapshot snapshot = engine.snapshot(playerId)
                .orElseThrow(() -> new ScoreRejectedException("unknown player"));
        if (snapshot.state() != PlayerState.DEAD) {
            throw new ScoreRejectedException("run still in progress");
        }
        var entry = new ScoreEntry(playerName, snapshot.score(), sha256(playerName + ":" + snapshot.score()), clock.instant());
        return repository.save(entry);
    }

    public List<ScoreEntry> top10() {
        return repository.findTop10ByOrderByScoreDesc();
    }

    static String sha256(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
