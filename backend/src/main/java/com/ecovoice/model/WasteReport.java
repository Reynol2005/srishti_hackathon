package com.ecovoice.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

/**
 * JPA entity mapping to the Supabase {@code waste_reports} table.
 * One row = one household's daily waste report.
 */
@Entity
@Table(name = "waste_reports")
public class WasteReport {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(name = "is_segregated", nullable = false)
    private boolean segregated;

    @Column(name = "volume_level", nullable = false)
    private int volumeLevel;

    @Column(name = "is_reused", nullable = false)
    private boolean reused;

    @Column(name = "daily_eco_score", nullable = false)
    private int dailyEcoScore;

    // ── Constructors ─────────────────────────────────────────

    public WasteReport() {}

    public WasteReport(String phoneNumber, LocalDate reportDate,
                       boolean segregated, int volumeLevel,
                       boolean reused, int dailyEcoScore) {
        this.phoneNumber = phoneNumber;
        this.reportDate = reportDate;
        this.segregated = segregated;
        this.volumeLevel = volumeLevel;
        this.reused = reused;
        this.dailyEcoScore = dailyEcoScore;
    }

    // ── Getters & Setters ────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public LocalDate getReportDate() { return reportDate; }
    public void setReportDate(LocalDate reportDate) { this.reportDate = reportDate; }

    public boolean isSegregated() { return segregated; }
    public void setSegregated(boolean segregated) { this.segregated = segregated; }

    public int getVolumeLevel() { return volumeLevel; }
    public void setVolumeLevel(int volumeLevel) { this.volumeLevel = volumeLevel; }

    public boolean isReused() { return reused; }
    public void setReused(boolean reused) { this.reused = reused; }

    public int getDailyEcoScore() { return dailyEcoScore; }
    public void setDailyEcoScore(int dailyEcoScore) { this.dailyEcoScore = dailyEcoScore; }
}
