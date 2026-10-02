package com.cyberrunner.net;

import com.cyberrunner.engine.GameEngine;
import com.cyberrunner.engine.PlayerSnapshot;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

@Controller
public class GameController {
    private static final Logger log = LoggerFactory.getLogger(GameController.class);
    private final GameEngine engine;

    public GameController(GameEngine engine) {
        this.engine = engine;
    }

    @MessageMapping("/join")
    @SendToUser("/queue/joined")
    public PlayerSnapshot join(@Valid JoinCommand cmd) {
        var player = engine.join(cmd.name());
        // COMP-GDPR-02: parameterized logging, no client IP or contact details
        log.info("player joined id={}", player.id());
        return engine.snapshot(player.id()).orElseThrow();
    }

    @MessageMapping("/jump")
    public void jump(JumpCommand cmd) {
        engine.jump(cmd.playerId());
    }
}
