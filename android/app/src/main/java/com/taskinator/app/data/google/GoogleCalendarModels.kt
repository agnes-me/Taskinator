package com.taskinator.app.data.google

import kotlinx.serialization.Serializable

@Serializable
data class CalendarListResponse(val items: List<CalendarListEntry> = emptyList())

@Serializable
data class CalendarListEntry(val id: String, val summary: String? = null)

@Serializable
data class EventsResponse(val items: List<GoogleCalendarEvent> = emptyList())

@Serializable
data class GoogleCalendarEvent(
    val id: String,
    val summary: String? = null,
    val start: EventDateTime? = null,
)

@Serializable
data class EventDateTime(
    val date: String? = null,
    val dateTime: String? = null,
)

/** Modèle simplifié utilisé une fois les événements de tous les agendas fusionnés et triés. */
@Serializable
data class MergedGoogleEvent(
    val id: String,
    val title: String,
    val calendarName: String?,
    val startDate: String,
    val startAt: String?,
)
