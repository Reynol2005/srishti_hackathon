package com.ecovoice.repository;

import com.ecovoice.model.WasteReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WasteReportRepository extends JpaRepository<WasteReport, UUID> {

    /** Find a specific report (for upsert logic). */
    Optional<WasteReport> findByPhoneNumberAndReportDate(String phoneNumber, LocalDate reportDate);

    /** All reports for a given date. */
    List<WasteReport> findByReportDate(LocalDate reportDate);

    /** All reports in a date range (inclusive). */
    List<WasteReport> findByReportDateBetween(LocalDate start, LocalDate end);

    /** Distinct phone numbers that reported on a given date. */
    @Query("SELECT DISTINCT w.phoneNumber FROM WasteReport w WHERE w.reportDate = :date")
    List<String> findDistinctPhonesByDate(@Param("date") LocalDate date);

    /** Leaderboard: top N users by total score in a date range. */
    @Query("""
        SELECT w.phoneNumber, SUM(w.dailyEcoScore) as totalScore
        FROM WasteReport w
        WHERE w.reportDate BETWEEN :start AND :end
        GROUP BY w.phoneNumber
        ORDER BY totalScore DESC
        LIMIT :limit
        """)
    List<Object[]> findLeaderboard(@Param("start") LocalDate start,
                                   @Param("end") LocalDate end,
                                   @Param("limit") int limit);

    /** Average score for a given date. */
    @Query("SELECT COALESCE(AVG(w.dailyEcoScore), 0) FROM WasteReport w WHERE w.reportDate = :date")
    double findAverageScoreByDate(@Param("date") LocalDate date);

    /** Daily averages over a date range (for trend chart). */
    @Query("""
        SELECT w.reportDate, AVG(w.dailyEcoScore), COUNT(w)
        FROM WasteReport w
        WHERE w.reportDate BETWEEN :start AND :end
        GROUP BY w.reportDate
        ORDER BY w.reportDate ASC
        """)
    List<Object[]> findDailyAverages(@Param("start") LocalDate start,
                                     @Param("end") LocalDate end);
}
