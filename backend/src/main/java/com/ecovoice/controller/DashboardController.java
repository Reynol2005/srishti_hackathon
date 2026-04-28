package com.ecovoice.controller;

import com.ecovoice.repository.WasteReportRepository;
import com.ecovoice.model.WasteReport;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dashboard REST API — serves aggregated data.
 * The React frontend can optionally call these instead of querying Supabase directly.
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final WasteReportRepository repo;

    public DashboardController(WasteReportRepository repo) {
        this.repo = repo;
    }

    /** Today's community average score. */
    @GetMapping("/today-average")
    public ResponseEntity<?> todayAverage() {
        LocalDate today = LocalDate.now();
        double avg = repo.findAverageScoreByDate(today);
        List<WasteReport> todayReports = repo.findByReportDate(today);

        return ResponseEntity.ok(Map.of(
            "average", Math.round(avg * 10.0) / 10.0,
            "count", todayReports.size(),
            "date", today.toString(),
            "maxScore", 20
        ));
    }

    /** Top 5 leaderboard for the past 7 days. */
    @GetMapping("/leaderboard")
    public ResponseEntity<?> leaderboard() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(6);

        List<Object[]> rows = repo.findLeaderboard(start, end, 5);

        List<Map<String, Object>> board = rows.stream().map(row -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("phone", maskPhone((String) row[0]));
            entry.put("totalScore", ((Number) row[1]).intValue());
            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
            "leaderboard", board,
            "period", Map.of("start", start.toString(), "end", end.toString())
        ));
    }

    /** 7-day score trend (daily averages). */
    @GetMapping("/trend")
    public ResponseEntity<?> trend() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(6);

        List<Object[]> rows = repo.findDailyAverages(start, end);

        // Build a map of existing data
        Map<LocalDate, Object[]> dataMap = new LinkedHashMap<>();
        for (Object[] row : rows) {
            dataMap.put((LocalDate) row[0], row);
        }

        // Fill in all 7 days (including days with no data)
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate date = start.plusDays(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", date.toString());

            if (dataMap.containsKey(date)) {
                Object[] row = dataMap.get(date);
                entry.put("avgScore", Math.round(((Number) row[1]).doubleValue() * 10.0) / 10.0);
                entry.put("count", ((Number) row[2]).intValue());
            } else {
                entry.put("avgScore", 0);
                entry.put("count", 0);
            }
            trend.add(entry);
        }

        return ResponseEntity.ok(Map.of("trend", trend));
    }

    /** All reports for the past 7 days (raw data). */
    @GetMapping("/reports")
    public ResponseEntity<?> reports() {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(6);
        List<WasteReport> data = repo.findByReportDateBetween(start, end);
        return ResponseEntity.ok(Map.of("reports", data, "count", data.size()));
    }

    // ── Helper ───────────────────────────────────────────────

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 6) return "***";
        return digits.substring(0, 3) + "***" + digits.substring(digits.length() - 3);
    }
}
