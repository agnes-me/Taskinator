package com.taskinator.app.data.ical

import com.taskinator.app.data.SupabaseConfig
import com.taskinator.app.data.SupabaseHttp
import com.taskinator.app.data.executeOrThrow
import com.taskinator.app.data.google.MergedGoogleEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

private val json = Json { ignoreUnknownKeys = true }

@Serializable
data class IcalSubscription(
    val id: String,
    val label: String,
    val url: String,
    val color: String,
    val visible: Boolean,
)

/**
 * Abonnements iCal (Google Calendar, Outlook, Apple Calendar…) de l'utilisateur, lus en HTTP
 * direct sans OAuth — même mécanisme et même table (ical_subscriptions) que l'appli web, pour que
 * les calendriers ajoutés d'un côté soient visibles de l'autre sans rien reconfigurer sur mobile.
 */
class IcalSubscriptionRepository(private val http: SupabaseHttp) {
    // Client sans les intercepteurs Supabase : ces requêtes partent vers l'hébergeur du calendrier
    // (Google, Outlook…), pas vers Supabase, il ne faut surtout pas y joindre la clé anon Supabase.
    private val plainClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun getSubscriptions(): List<IcalSubscription> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/ical_subscriptions".toHttpUrl().newBuilder()
            .addQueryParameter("select", "id,label,url,color,visible")
            .addQueryParameter("order", "sort_order.asc")
            .build()
        val request = Request.Builder().url(url).get().build()
        http.client.executeOrThrow(request).use { resp -> json.decodeFromString(resp.body!!.string()) }
    }

    /** Événements de tous les abonnements visibles, sur l'intervalle donné (bornes incluses). */
    suspend fun getMergedEvents(rangeStart: LocalDate, rangeEnd: LocalDate): List<MergedGoogleEvent> = withContext(Dispatchers.IO) {
        val subs = runCatching { getSubscriptions() }.getOrDefault(emptyList()).filter { it.visible }
        subs.flatMap { sub ->
            val text = fetchIcsText(sub.url) ?: return@flatMap emptyList()
            runCatching { parseIcsEvents(text) }.getOrDefault(emptyList())
                .filter { !it.date.isBefore(rangeStart) && !it.date.isAfter(rangeEnd) }
                .map { event ->
                    MergedGoogleEvent(
                        id = "${sub.id}:${event.id}",
                        title = event.summary,
                        calendarName = sub.label,
                        startDate = event.date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        startAt = event.startAt?.atZone(ZoneId.systemDefault())?.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                        color = sub.color,
                    )
                }
        }
    }

    private fun fetchIcsText(url: String): String? = try {
        val request = Request.Builder().url(url).get().build()
        plainClient.newCall(request).execute().use { resp -> if (resp.isSuccessful) resp.body?.string() else null }
    } catch (e: Exception) {
        null
    }
}
