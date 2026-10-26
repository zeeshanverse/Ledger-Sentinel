package dev.zeeshan.ledgersentinel.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.zeeshan.ledgersentinel.domain.RiskDecision;
import dev.zeeshan.ledgersentinel.domain.TransactionRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RiskService {

    private final String mlServiceUrl;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public RiskService(
            @Value("${ml.service.url}") String mlServiceUrl,
            ObjectMapper objectMapper
    ) {
        this.mlServiceUrl = mlServiceUrl;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();

        System.out.println("ML SERVICE URL = " + mlServiceUrl);
    }

    public RiskDecision evaluate(TransactionRequest t) {

        Map<String, Object> body = new LinkedHashMap<>();

        body.put("amount", t.amount());
        body.put("balanceBefore", t.balanceBefore());
        body.put("balanceAfter", t.balanceAfter());
        body.put("country", t.country());
        body.put("merchantCategory", t.merchantCategory());
        body.put("hour", t.hour());
        body.put("velocity15m", t.velocity15m());

        try {

            System.out.println("Calling ML service: /predict");
            System.out.println("Request body: " + body);

            String jsonBody;

            try {
                jsonBody = objectMapper.writeValueAsString(body);
            } catch (JsonProcessingException e) {
                throw new RuntimeException(
                        "Failed to serialize ML request",
                        e
                );
            }

            System.out.println("JSON SENT TO ML: " + jsonBody);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            HttpEntity<String> requestEntity =
                    new HttpEntity<>(jsonBody, headers);

            ResponseEntity<Map> mlResponse =
                    restTemplate.postForEntity(
                            mlServiceUrl + "/predict",
                            requestEntity,
                            Map.class
                    );

            System.out.println("ML STATUS: " + mlResponse.getStatusCode());
            System.out.println("ML RESPONSE: " + mlResponse.getBody());

            Map<?, ?> response = mlResponse.getBody();

            if (response == null) {
                throw new IllegalStateException(
                        "ML service returned an empty response"
                );
            }

            Object probabilityValue = response.get("probability");

            if (!(probabilityValue instanceof Number probabilityNumber)) {
                throw new IllegalStateException(
                        "Invalid probability returned by ML service: "
                                + probabilityValue
                );
            }

            double probability = probabilityNumber.doubleValue();

            String decision;

            if (probability >= 0.80) {
                decision = "BLOCK";
            } else if (probability >= 0.45) {
                decision = "REVIEW";
            } else {
                decision = "ALLOW";
            }

            Object reasonsValue = response.get("reasons");

            List<String> reasons;

            if (reasonsValue instanceof List<?> list) {
                reasons = list.stream()
                        .map(String::valueOf)
                        .toList();
            } else {
                reasons = List.of();
            }

            String modelVersion =
                    String.valueOf(response.get("modelVersion"));

            return new RiskDecision(
                    t.transactionId(),
                    probability,
                    decision,
                    modelVersion,
                    reasons
            );

        } catch (Exception e) {

            System.err.println("========== ML SERVICE ERROR ==========");
            e.printStackTrace();
            System.err.println("======================================");

            throw e;
        }
    }
}