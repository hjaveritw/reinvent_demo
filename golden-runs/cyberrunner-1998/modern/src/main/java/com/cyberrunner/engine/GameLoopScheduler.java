package com.cyberrunner.engine;

import org.springframework.context.SmartLifecycle;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Replaces the legacy {@code while(true){ step(); Thread.sleep(16); }} loop with a fixed-rate virtual-thread scheduler. */
@Component
public class GameLoopScheduler implements SmartLifecycle {
    private final GameEngine engine;
    private final SimpMessagingTemplate broker;
    private ScheduledExecutorService executor;

    public GameLoopScheduler(GameEngine engine, SimpMessagingTemplate broker) {
        this.engine = engine;
        this.broker = broker;
    }

    @Override
    public void start() {
        executor = Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().name("game-loop").factory());
        executor.scheduleAtFixedRate(() -> broker.convertAndSend("/topic/state", engine.step()),
                0, GameConstants.TICK_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    public void stop() {
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
    }

    @Override
    public boolean isRunning() {
        return executor != null;
    }
}
