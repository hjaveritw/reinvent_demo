package warm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WarmAppTest {
    @Autowired
    MockMvc mvc;

    @Autowired
    ItemRepository repo;

    @Test
    @WithMockUser
    void ping() throws Exception {
        mvc.perform(get("/ping")).andExpect(status().isOk());
        assertThat(repo.count()).isZero();
    }
}
