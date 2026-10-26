package dev.zeeshan.ledgersentinel.domain;
import jakarta.validation.constraints.*;
public record TransactionRequest(
 @NotBlank String transactionId, @NotBlank String accountId,
 @PositiveOrZero double amount, @PositiveOrZero double balanceBefore, @PositiveOrZero double balanceAfter,
 @NotBlank String country, @NotBlank String merchantCategory,
 @Min(0) @Max(23) int hour, @PositiveOrZero int velocity15m) {}
