package com.cyberrunner.config;

import com.cyberrunner.engine.GameEngine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.SecureRandom;

@Configuration
public class GameConfig {
    @Bean
    public GameEngine gameEngine() {
        return new GameEngine(new SecureRandom());
    }
}
