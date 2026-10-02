package com.cyberrunner.score;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/scores")
public class ScoreController {
    private final ScoreService service;

    public ScoreController(ScoreService service) {
        this.service = service;
    }

    public record SubmitScore(@Positive int playerId, @Pattern(regexp = "^[A-Za-z0-9_-]{1,16}$") String playerName) {
    }

    @GetMapping
    public List<ScoreEntry> top10() {
        return service.top10();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreEntry submit(@Valid @RequestBody SubmitScore body) {
        return service.recordFinalScore(body.playerId(), body.playerName());
    }

    @ExceptionHandler(ScoreRejectedException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public String rejected(ScoreRejectedException e) {
        return e.getMessage();
    }
}
