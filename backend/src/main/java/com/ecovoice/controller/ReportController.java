package com.ecovoice.controller;

import com.ecovoice.model.WasteReport;
import com.ecovoice.repository.WasteReportRepository;
import com.ecovoice.service.EcoScoreService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Receives waste reports from the Android SMS Gateway.
 *
 * POST /api/report
 * Body: { "phoneNumber": "+919876543210", "digits": "1-2-1" }
 */
@RestController
@RequestMapping("/api")
public class ReportController {

    private final WasteReportRepository repo;
    private final EcoScoreService scoreService;

    public ReportController(WasteReportRepository repo, EcoScoreService scoreService) {
        this.repo = repo;
        this.scoreService = scoreService;
    }

    @PostMapping("/report")
    public ResponseEntity<?> submitReport(@RequestBody Map<String, String> body) {
        String phoneNumber = body.get("phoneNumber");
        String digits = body.get("digits");

        // ── Validate ─────────────────────────────────────────
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing 'phoneNumber'"));
        }
        if (digits == null || digits.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing 'digits'"));
        }

        // ── Parse & score ────────────────────────────────────
        Map<String, Object> choices;
        try {
            choices = scoreService.parseDigits(digits);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        boolean segregated = (boolean) choices.get("segregated");
        int volumeLevel = (int) choices.get("volumeLevel");
        boolean reused = (boolean) choices.get("reused");
        int score = scoreService.calculate(segregated, reused, volumeLevel);

        // ── Upsert (one report per phone per day) ────────────
        LocalDate today = LocalDate.now();
        Optional<WasteReport> existing = repo.findByPhoneNumberAndReportDate(phoneNumber, today);

        WasteReport report;
        if (existing.isPresent()) {
            report = existing.get();
            report.setSegregated(segregated);
            report.setVolumeLevel(volumeLevel);
            report.setReused(reused);
            report.setDailyEcoScore(score);
        } else {
            report = new WasteReport(phoneNumber, today, segregated, volumeLevel, reused, score);
        }
        repo.save(report);

        // ── Response ─────────────────────────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Report saved");
        response.put("phoneNumber", phoneNumber);
        response.put("reportDate", today.toString());
        response.put("score", score);
        response.put("breakdown", scoreService.buildBreakdown(segregated, volumeLevel, reused, score));
        return ResponseEntity.ok(response);
    }
}
