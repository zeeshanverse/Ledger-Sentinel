package dev.zeeshan.ledgersentinel.domain;
import java.util.List;
public record RiskDecision(String transactionId,double riskScore,String decision,String modelVersion,List<String> reasons) {}
