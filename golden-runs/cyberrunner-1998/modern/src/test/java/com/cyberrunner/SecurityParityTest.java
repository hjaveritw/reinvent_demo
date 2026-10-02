package com.cyberrunner;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityParityTest {
    @Autowired
    MockMvc mvc;

    @Test
    void anonymousCallersAreRejected() throws Exception {
        mvc.perform(get("/api/scores")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void authenticatedCallersCanReadLeaderboard() throws Exception {
        mvc.perform(get("/api/scores")).andExpect(status().isOk());
    }
}
