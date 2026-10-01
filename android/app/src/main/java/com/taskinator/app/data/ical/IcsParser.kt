package com.taskinator.app.data.ical

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class IcsEvent(val id: String, val summary: String, val date: LocalDate, val startAt: LocalDateTime?)

private val WEEKDAY_INDEX = mapOf("SU" to 0, "MO" to 1, "TU" to 2, "WE" to 3, "TH" to 4, "FR" to 5, "SA" to 6)
private val DATE_RE = Regex("^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2})(Z)?)?$")
private const val EXPAND_MONTHS_BACK = 6L
private const val EXPAND_MONTHS_FORWARD = 18L
private const val MAX_OCCURRENCES = 500

private data class RRule(val freq: String, val interval: Int, val count: Int?, val until: LocalDate?, val byDay: List<String>?)

// Déplie les lignes RFC 5545 : une ligne de continuation commence par une espace/tabulation — port
// Kotlin du parseur déjà utilisé côté web (src/lib/google-ical.ts), même limites assumées (pas de
// BYMONTHDAY/BYSETPOS, fenêtre d'expansion bornée plutôt qu'illimitée).
private fun unfold(text: String): List<String> {
    val rawLines = text.split(Regex("\r\n|\n|\r"))
    val lines = mutableListOf<String>()
    for (line in rawLines) {
        if ((line.startsWith(" ") || line.startsWith("\t")) && lines.isNotEmpty()) {
            lines[lines.size - 1] = lines.last() + line.substring(1)
        } else {
            lines.add(line)
        }
    }
    return lines
}

private fun parseIcsDate(value: String, allDay: Boolean): LocalDateTime? {
    val m = DATE_RE.matchEntire(value) ?: return null
    val g = m.groupValues
    val year = g[1].toInt()
    val month = g[2].toInt()
    val day = g[3].toInt()
    if (allDay || g[4].isEmpty()) return LocalDateTime.of(year, month, day, 0, 0, 0)
    val hour = g[4].toInt()
    val minute = g[5].toInt()
    val second = g[6].toInt()
    val naive = LocalDateTime.of(year, month, day, hour, minute, second)
    // Sans indication de fuseau explicite (TZID ou Z), on traite l'heure comme locale — même
    // simplification assumée côté web.
    return if (g[7] == "Z") {
        naive.atOffset(ZoneOffset.UTC).atZoneSameInstant(java.time.ZoneId.systemDefault()).toLocalDateTime()
    } else {
        naive
    }
}

private fun parseRRule(value: String): RRule? {
    val map = mutableMapOf<String, String>()
    for (part in value.split(";")) {
        val kv = part.split("=", limit = 2)
        if (kv.size == 2) map[kv[0].uppercase()] = kv[1]
    }
    val freq = map["FREQ"] ?: return null
    if (freq != "DAILY" && freq != "WEEKLY" && freq != "MONTHLY" && freq != "YEARLY") return null

    val byDay = map["BYDAY"]?.split(",")
    // BYMONTHDAY/BYSETPOS ("2e mardi du mois", etc.) non gérés : mieux vaut ignorer l'événement
    // que d'afficher une date fausse.
    if ((freq == "MONTHLY" || freq == "YEARLY") && !byDay.isNullOrEmpty()) return null

    val untilRaw = map["UNTIL"]
    val until = untilRaw?.let { parseIcsDate(it, !it.contains("T"))?.toLocalDate() }
    return RRule(
        freq = freq,
        interval = (map["INTERVAL"]?.toIntOrNull() ?: 1).coerceAtLeast(1),
        count = map["COUNT"]?.toIntOrNull(),
        until = until,
        byDay = if (freq == "WEEKLY") byDay else null,
    )
}

private fun expandRecurring(start: LocalDateTime, rule: RRule): List<LocalDateTime> {
    val now = LocalDate.now()
    val windowStart = now.minusMonths(EXPAND_MONTHS_BACK).atStartOfDay()
    val windowEnd = now.plusMonths(EXPAND_MONTHS_FORWARD).atStartOfDay()
    val hardEnd = rule.until?.atStartOfDay()?.let { if (it.isBefore(windowEnd)) it else windowEnd } ?: windowEnd
    val occurrences = mutableListOf<LocalDateTime>()

    if (rule.freq == "WEEKLY" && !rule.byDay.isNullOrEmpty()) {
        val days = rule.byDay.mapNotNull { WEEKDAY_INDEX[it] }
        var weekStart = start.toLocalDate().let { it.minusDays((it.dayOfWeek.value % 7).toLong()) } // dimanche de la semaine de départ
        var weekIndex = 0
        var total = 0
        while (!weekStart.atStartOfDay().isAfter(hardEnd) && total < MAX_OCCURRENCES) {
            if (weekIndex % rule.interval == 0) {
                for (dow in days) {
                    val occ = weekStart.plusDays(dow.toLong()).atTime(start.toLocalTime())
                    if (!occ.isBefore(start) && !occ.isBefore(windowStart) && !occ.isAfter(hardEnd)) {
                        occurrences.add(occ)
                        total++
                        if (rule.count != null && total >= rule.count) return occurrences
                    }
                }
            }
            weekStart = weekStart.plusDays(7)
            weekIndex++
        }
        return occurrences
    }

    var current = start
    var total = 0
    while (!current.isAfter(hardEnd) && total < MAX_OCCURRENCES) {
        if (!current.isBefore(windowStart)) {
            occurrences.add(current)
            total++
            if (rule.count != null && total >= rule.count) break
        }
        current = when (rule.freq) {
            "DAILY" -> current.plusDays(rule.interval.toLong())
            "WEEKLY" -> current.plusDays(7L * rule.interval)
            "MONTHLY" -> current.plusMonths(rule.interval.toLong())
            else -> current.plusYears(rule.interval.toLong())
        }
    }
    return occurrences
}

fun parseIcsEvents(text: String): List<IcsEvent> {
    val lines = unfold(text)
    val events = mutableListOf<IcsEvent>()
    var inEvent = false
    var summary = ""
    var dtstart = ""
    var allDay = false
    var rrule: String? = null
    var exdates = mutableListOf<String>()
    var uid = ""
    var counter = 0

    for (line in lines) {
        when {
            line.startsWith("BEGIN:VEVENT") -> {
                inEvent = true
                summary = ""
                dtstart = ""
                allDay = false
                rrule = null
                exdates = mutableListOf()
                uid = ""
            }
            line.startsWith("END:VEVENT") -> {
                if (inEvent && dtstart.isNotEmpty()) {
                    val startDateTime = parseIcsDate(dtstart, allDay)
                    if (startDateTime != null) {
                        val exSet = exdates.toSet()
                        val baseId = uid.ifEmpty { "ical-${counter++}" }
                        val title = summary.ifEmpty { "(Sans titre)" }
                        val rule = rrule
                        if (rule == null) {
                            events.add(IcsEvent(baseId, title, startDateTime.toLocalDate(), if (allDay) null else startDateTime))
                        } else {
                            val parsed = parseRRule(rule)
                            if (parsed != null) {
                                for (occ in expandRecurring(startDateTime, parsed)) {
                                    val occDateStr = occ.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
                                    if (occDateStr in exSet) continue
                                    events.add(IcsEvent("$baseId-$occDateStr", title, occ.toLocalDate(), if (allDay) null else occ))
                                }
                            }
                        }
                    }
                }
                inEvent = false
            }
            !inEvent -> {}
            line.startsWith("SUMMARY") -> {
                val idx = line.indexOf(':')
                if (idx >= 0) summary = line.substring(idx + 1).replace("\\,", ",").replace(Regex("\\\\n", RegexOption.IGNORE_CASE), " ")
            }
            line.startsWith("DTSTART") -> {
                allDay = line.startsWith("DTSTART;VALUE=DATE:") || (line.contains("VALUE=DATE") && !line.contains("VALUE=DATE-TIME"))
                val idx = line.indexOf(':')
                if (idx >= 0) dtstart = line.substring(idx + 1)
            }
            line.startsWith("RRULE") -> {
                val idx = line.indexOf(':')
                if (idx >= 0) rrule = line.substring(idx + 1)
            }
            line.startsWith("EXDATE") -> {
                val idx = line.indexOf(':')
                if (idx >= 0) {
                    for (raw in line.substring(idx + 1).split(",")) {
                        val d = parseIcsDate(raw, !raw.contains("T"))
                        if (d != null) exdates.add(d.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE))
                    }
                }
            }
            line.startsWith("UID") -> {
                val idx = line.indexOf(':')
                if (idx >= 0) uid = line.substring(idx + 1)
            }
        }
    }

    return events
}
