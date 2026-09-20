package com.taskinator.app.data.google

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

private val json = Json { ignoreUnknownKeys = true }
private const val CALENDAR_API = "https://www.googleapis.com/calendar/v3"

/** Appels REST directs à Google Calendar (v3), lecture seule, avec le jeton d'accès obtenu via GoogleAuthManager. */
class GoogleCalendarRepository {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    /** Événements des 7 prochains jours, tous agendas confondus, triés par date/heure de début. */
    suspend fun getUpcomingEvents(accessToken: String, daysAhead: Long = 7): List<MergedGoogleEvent> = withContext(Dispatchers.IO) {
        val calendars = runCatching { fetchCalendarList(accessToken) }.getOrDefault(emptyList())
        if (calendars.isEmpty()) return@withContext emptyList()

        val now = Instant.now()
        val timeMin = now.toString()
        val timeMax = now.plus(daysAhead, ChronoUnit.DAYS).toString()

        val merged = mutableListOf<MergedGoogleEvent>()
        for (calendar in calendars) {
            val events = runCatching { fetchEvents(accessToken, calendar.id, timeMin, timeMax) }.getOrDefault(emptyList())
            for (event in events) {
                val start = event.start ?: continue
                val date = start.date ?: start.dateTime?.substring(0, 10) ?: continue
                merged += MergedGoogleEvent(
                    id = event.id,
                    title = event.summary ?: "(Sans titre)",
                    calendarName = calendar.summary,
                    startDate = date,
                    startAt = start.dateTime,
                )
            }
        }
        merged.sortedWith(compareBy({ it.startDate }, { it.startAt ?: "" }))
    }

    private fun fetchCalendarList(accessToken: String): List<CalendarListEntry> {
        val url = "$CALENDAR_API/users/me/calendarList".toHttpUrl().newBuilder()
            .addQueryParameter("minAccessRole", "reader")
            .build()
        val request = Request.Builder().url(url).header("Authorization", "Bearer $accessToken").get().build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val body = resp.body?.string() ?: return emptyList()
            return json.decodeFromString<CalendarListResponse>(body).items
        }
    }

    private fun fetchEvents(accessToken: String, calendarId: String, timeMin: String, timeMax: String): List<GoogleCalendarEvent> {
        val encodedId = URLEncoder.encode(calendarId, "UTF-8")
        val url = "$CALENDAR_API/calendars/$encodedId/events".toHttpUrl().newBuilder()
            .addQueryParameter("timeMin", timeMin)
            .addQueryParameter("timeMax", timeMax)
            .addQueryParameter("singleEvents", "true")
            .addQueryParameter("orderBy", "startTime")
            .addQueryParameter("maxResults", "15")
            .build()
        val request = Request.Builder().url(url).header("Authorization", "Bearer $accessToken").get().build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return emptyList()
            val body = resp.body?.string() ?: return emptyList()
            return json.decodeFromString<EventsResponse>(body).items
        }
    }
}
