package com.ecovoice.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Scoring logic for daily waste reports.
 *
 * Rules:
 *   +10  if waste is segregated
 *   +5   if waste is reused
 *   +5   if volume level is 1 (Low)
 *
 * Maximum possible score: 20
 */
@Service
public class EcoScoreService {

    public static final int MAX_SCORE = 20;

    private static final Map<Integer, String> VOLUME_LABELS = Map.of(
        1, "Low", 2, "Medium", 3, "High"
    );

    /**
     * Calculate the eco-score from raw choices.
     */
    public int calculate(boolean segregated, boolean reused, int volumeLevel) {
        int score = 0;
        if (segregated) score += 10;
        if (reused) score += 5;
        if (volumeLevel == 1) score += 5;
        return score;
    }

    /**
     * Parse a digit string like "1-2-1" into structured choices.
     *
     * @return map with keys: segregated, volumeLevel, reused
     * @throws IllegalArgumentException on invalid input
     */
    public Map<String, Object> parseDigits(String digits) {
        if (digits == null || digits.isBlank()) {
            throw new IllegalArgumentException("Digits string is empty");
        }

        String[] parts = digits.trim().split("-");
        if (parts.length != 3) {
            throw new IllegalArgumentException(
                "Expected 3 digits separated by '-', got: " + digits);
        }

        int segKey = parseDigit(parts[0], "segregation", 1, 2);
        int volKey = parseDigit(parts[1], "volume", 1, 3);
        int reuseKey = parseDigit(parts[2], "reuse", 1, 2);

        boolean segregated = (segKey == 1);
        boolean reused = (reuseKey == 1);

        Map<String, Object> choices = new LinkedHashMap<>();
        choices.put("segregated", segregated);
        choices.put("volumeLevel", volKey);
        choices.put("volumeLabel", VOLUME_LABELS.getOrDefault(volKey, "Unknown"));
        choices.put("reused", reused);
        return choices;
    }

    /**
     * Build a human-readable score breakdown.
     */
    public Map<String, Object> buildBreakdown(boolean segregated, int volumeLevel, boolean reused, int score) {
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("segregated", Map.of("value", segregated, "points", segregated ? 10 : 0));
        breakdown.put("volume", Map.of(
            "value", VOLUME_LABELS.getOrDefault(volumeLevel, "Unknown"),
            "points", volumeLevel == 1 ? 5 : 0));
        breakdown.put("reused", Map.of("value", reused, "points", reused ? 5 : 0));
        breakdown.put("total", score);
        breakdown.put("maxScore", MAX_SCORE);
        return breakdown;
    }

    private int parseDigit(String raw, String label, int min, int max) {
        try {
            int val = Integer.parseInt(raw.trim());
            if (val < min || val > max) {
                throw new IllegalArgumentException(
                    "Invalid " + label + " digit: " + raw + " (expected " + min + "-" + max + ")");
            }
            return val;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid " + label + " digit: " + raw);
        }
    }
}
