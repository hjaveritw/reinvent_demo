package com.acmebank.web;

import com.acmebank.service.TransferService;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class TransferServlet extends HttpServlet {
    private static final Logger log = LogManager.getLogger(TransferServlet.class);
    private final TransferService service = new TransferService();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String from = req.getParameter("from");
        String to = req.getParameter("to");
        String amount = req.getParameter("amount");
        String card = req.getParameter("cardNumber");
        log.info("Transfer request from=" + from + " to=" + to + " amount=" + amount + " card=" + card
                + " ip=" + req.getRemoteAddr() + " ua=" + req.getHeader("User-Agent"));
        try {
            String ref = service.transfer(from, to, Double.parseDouble(amount), card);
            resp.getWriter().write("{\"status\":\"OK\",\"ref\":\"" + ref + "\"}");
        } catch (Exception e) {
            resp.setStatus(500);
            resp.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
