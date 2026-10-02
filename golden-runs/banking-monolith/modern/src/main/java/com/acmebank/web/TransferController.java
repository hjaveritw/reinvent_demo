package com.acmebank.web;

import com.acmebank.service.TransferException;
import com.acmebank.service.TransferResult;
import com.acmebank.service.TransferService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;

/** Replaces javax.servlet TransferServlet with a validated Spring MVC (Jakarta EE 10) endpoint. */
@RestController
@RequestMapping("/api/transfers")
public class TransferController {
    private static final Logger log = LoggerFactory.getLogger(TransferController.class);
    private final TransferService service;

    public TransferController(TransferService service) {
        this.service = service;
    }

    @PostMapping
    public TransferResult transfer(@Valid @RequestBody TransferRequest req) {
        // COMP-GDPR-02: parameterized, no PAN / IP / user agent in logs
        log.info("transfer requested from={} to={} amount={}", req.from(), req.to(), req.amount());
        return service.transfer(req.from(), req.to(), req.amount(), req.cardNumber());
    }

    @ExceptionHandler(TransferException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetail rejected(TransferException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }
}
