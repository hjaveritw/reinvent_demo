package com.acmebank.repository;

import com.acmebank.model.Account;
import org.springframework.data.jpa.repository.JpaRepository;

/** Parameterized queries replace string-concatenated JDBC SQL (CWE-89). */
public interface AccountRepository extends JpaRepository<Account, String> {
}
