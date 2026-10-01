package com.taskinator.app.widget.calendar

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.google.GoogleCalendarStore
import java.time.LocalDate
import java.util.concurrent.TimeUnit

internal suspend fun refreshCalendarWidget(context: Context, app: TaskinatorApplication) {
    val userId = app.container.authRepository.currentUserId()
    val tasks = if (userId != null) {
        runCatching { app.container.taskRepository.getMyUpcomingTasks(userId) }.getOrDefault(emptyList())
    } else {
        emptyList()
    }

    val googleStore = GoogleCalendarStore(context)
    val googleConnected = googleStore.isConnected()
    val oauthEvents = if (googleConnected) {
        val token = runCatching { app.container.googleAuthManager.getAccessTokenSilently() }.getOrNull()
        if (token != null) {
            runCatching { app.container.googleCalendarRepository.getUpcomingEvents(token) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
    } else {
        emptyList()
    }
    // Abonnements iCal (même table que l'appli web) : indépendants de la connexion Google ci-dessus.
    val icalEvents = runCatching {
        val today = LocalDate.now()
        app.container.icalSubscriptionRepository.getMergedEvents(today, today.plusDays(30))
    }.getOrDefault(emptyList())
    val googleEvents = oauthEvents + icalEvents

    val data = CalendarWidgetData(tasks = tasks, googleEvents = googleEvents, googleConnected = googleConnected)
    val json = calendarWidgetJson.encodeToString(CalendarWidgetData.serializer(), data)

    val manager = GlanceAppWidgetManager(context)
    val glanceIds = manager.getGlanceIds(CalendarWidget::class.java)
    for (glanceId in glanceIds) {
        updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
            prefs.toMutablePreferences().apply { this[CALENDAR_WIDGET_DATA_KEY] = json }
        }
    }
    CalendarWidget().updateAll(context)
}

class CalendarWidgetWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as TaskinatorApplication
        refreshCalendarWidget(applicationContext, app)
        return Result.success()
    }
}

object CalendarWidgetRefresh {
    private const val ONE_TIME_NAME = "taskinator_calendar_widget_refresh"
    private const val PERIODIC_NAME = "taskinator_calendar_widget_refresh_periodic"

    fun enqueueOneTime(context: Context) {
        val request = OneTimeWorkRequestBuilder<CalendarWidgetWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun enqueuePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<CalendarWidgetWorker>(30, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
