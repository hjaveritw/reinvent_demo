package com.cyberrunner.engine;

import org.junit.jupiter.api.Test;

import java.util.SplittableRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Behavioural parity with legacy GameLoop / Player / World (RESS BR-01..BR-09). */
class GameEngineParityTest {
    private final GameEngine engine = new GameEngine(new SplittableRandom(42));

    @Test
    void jumpAppliesVelocityThenGravityInSameTick() {
        var p = engine.join("neo");
        engine.jump(p.id());
        engine.step();
        assertThat(p.vy()).isCloseTo(-10.4, within(1e-9));
        assertThat(p.y()).isCloseTo(289.6, within(1e-9));
        assertThat(p.state()).isEqualTo(PlayerState.JUMPING);
    }

    @Test
    void noDoubleJumpWhileAirborne() {
        var p = engine.join("trinity");
        engine.jump(p.id());
        engine.step();
        double vyBefore = p.vy();
        engine.jump(p.id());
        engine.step();
        assertThat(p.vy()).isCloseTo(vyBefore + GameConstants.GRAVITY, within(1e-9));
    }

    @Test
    void playerLandsAndReturnsToRunning() {
        var p = engine.join("morpheus");
        engine.jump(p.id());
        for (int i = 0; i < 40; i++) {
            engine.step();
        }
        assertThat(p.y()).isEqualTo(GameConstants.GROUND_Y);
        assertThat(p.state()).isEqualTo(PlayerState.RUNNING);
    }

    @Test
    void speedRampsEveryTickAndIsCapped() {
        engine.step();
        assertThat(engine.speed()).isCloseTo(4.001, within(1e-9));
        for (int i = 0; i < 20_000; i++) {
            engine.step();
        }
        assertThat(engine.speed()).isEqualTo(GameConstants.MAX_SPEED);
    }

    @Test
    void scoreDoublesAboveEightPixelsPerTick() {
        assertThat(GameEngine.scoreFor(1000, 8.0)).isEqualTo(100);
        assertThat(GameEngine.scoreFor(1000, 8.01)).isEqualTo(200);
    }

    @Test
    void spawnIntervalShrinksWithSpeedAndIsFloored() {
        assertThat(GameEngine.spawnInterval(4.0)).isEqualTo(90);
        assertThat(GameEngine.spawnInterval(8.0)).isEqualTo(45);
        assertThat(GameEngine.spawnInterval(14.0)).isEqualTo(30);
    }

    @Test
    void tickCounterAdvancesOncePerStep() {
        var event = engine.step();
        assertThat(event.tick()).isEqualTo(1);
        assertThat(engine.step().tick()).isEqualTo(2);
    }
}
