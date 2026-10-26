package dev.zeeshan.ledgersentinel.api;

import dev.zeeshan.ledgersentinel.domain.RiskDecision;
import dev.zeeshan.ledgersentinel.domain.TransactionRequest;
import dev.zeeshan.ledgersentinel.service.RiskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/risk")
public class RiskController {

    private final RiskService service;

    public RiskController(RiskService service) {
        this.service = service;
    }

    @PostMapping("/evaluate")
    public RiskDecision evaluate(@Valid @RequestBody TransactionRequest request) {
        System.out.println("=== RISK REQUEST RECEIVED ===");
        System.out.println("Transaction ID: " + request.transactionId());
        System.out.println("Account ID: " + request.accountId());

        return service.evaluate(request);
    }

    @GetMapping("/health")
    public String health() {
        return "ledger-sentinel-ok";
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", "Validation failed");

        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult()
                .getFieldErrors()
                .forEach(error -> fields.put(error.getField(), error.getDefaultMessage()));

        response.put("fields", fields);
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableRequest(HttpMessageNotReadableException ex) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", "Request body could not be parsed");
        response.put("message", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.badRequest().body(response);
    }

    /** ML service down / unreachable / returned an error -> clean JSON instead of a raw 500. */
    @ExceptionHandler({RestClientException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> handleMlFailure(Exception ex) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("error", "ML service unavailable");
        response.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
}
