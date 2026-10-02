package com.cyberrunner.score;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Parameterized JPA queries replace legacy string-concatenated SQL (CWE-89). */
public interface ScoreRepository extends JpaRepository<ScoreEntry, Long> {
    List<ScoreEntry> findTop10ByOrderByScoreDesc();
}
