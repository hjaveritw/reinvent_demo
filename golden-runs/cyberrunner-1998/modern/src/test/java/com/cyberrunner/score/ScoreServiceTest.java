package com.cyberrunner.score;

import com.cyberrunner.engine.GameEngine;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.SplittableRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ScoreServiceTest {
    private final GameEngine engine = new GameEngine(new SplittableRandom(7));
    private final ScoreRepository repo = Mockito.mock(ScoreRepository.class);
    private final ScoreService service = new ScoreService(engine, repo,
            Clock.fixed(Instant.parse("2026-10-02T00:00:00Z"), ZoneOffset.UTC));

    @Test
    void rejectsScoreWhileRunInProgress() {
        var p = engine.join("neo");
        assertThatThrownBy(() -> service.recordFinalScore(p.id(), "neo"))
                .isInstanceOf(ScoreRejectedException.class);
    }

    @Test
    void rejectsSqlInjectionInPlayerName() {
        assertThatThrownBy(() -> service.recordFinalScore(1, "x'); DROP TABLE scores;--"))
                .isInstanceOf(ScoreRejectedException.class);
    }

    @Test
    void recordsServerComputedScoreForFinishedRun() {
        when(repo.save(any(ScoreEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        var p = engine.join("neo");
        while (engine.snapshot(p.id()).orElseThrow().state() != com.cyberrunner.engine.PlayerState.DEAD) {
            engine.step();
        }
        var entry = service.recordFinalScore(p.id(), "neo");
        assertThat(entry.getScore()).isEqualTo(p.score()).isPositive();
        assertThat(entry.getSignature()).hasSize(64);
    }
}
