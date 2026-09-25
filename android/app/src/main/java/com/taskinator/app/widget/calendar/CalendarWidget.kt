package com.taskinator.app.widget.calendar

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.LocalContext
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.defaultWeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.taskinator.app.MainActivity
import com.taskinator.app.data.WidgetAppearanceStore
import com.taskinator.app.data.google.MergedGoogleEvent
import com.taskinator.app.data.models.TaskItem
import com.taskinator.app.widget.WidgetStyle
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle as JavaTextStyle
import java.util.Locale

@Serializable
data class CalendarWidgetData(
    val tasks: List<TaskItem> = emptyList(),
    val googleEvents: List<MergedGoogleEvent> = emptyList(),
    val googleConnected: Boolean = false,
)

internal val CALENDAR_WIDGET_DATA_KEY = stringPreferencesKey("calendar_widget_data_json")
internal val calendarWidgetJson = Json { ignoreUnknownKeys = true }
internal val CALENDAR_TASK_ID_KEY = ActionParameters.Key<String>("calendar_task_id")

/** Une entrée dans la colonne d'un jour — tâche (case à cocher) ou événement (point coloré). */
private data class DayAgendaItem(val time: String?, val title: String, val color: String?, val taskId: String?)

private val HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm")

private fun localTimeLabel(startAt: String): String? =
    runCatching { OffsetDateTime.parse(startAt).atZoneSameInstant(ZoneId.systemDefault()).format(HOUR_MINUTE) }.getOrNull()

class CalendarWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val opacity = WidgetAppearanceStore.currentOpacity(context)
        provideContent {
            CalendarWidgetContent(opacity)
        }
    }
}

@Composable
private fun CalendarWidgetContent(opacity: Float) {
    val prefs = currentState<Preferences>()
    val storedJson = prefs[CALENDAR_WIDGET_DATA_KEY]
    val data = storedJson
        ?.let { runCatching { calendarWidgetJson.decodeFromString(CalendarWidgetData.serializer(), it) }.getOrNull() }
        ?: CalendarWidgetData()

    val monday = LocalDate.now().with(DayOfWeek.MONDAY)
    val days = (0..6).map { monday.plusDays(it.toLong()) }
    val today = LocalDate.now()

    val itemsByDay = days.associateWith { mutableListOf<DayAgendaItem>() }
    data.tasks.forEach { t ->
        val due = t.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@forEach
        itemsByDay[due]?.add(DayAgendaItem(null, t.title, null, t.id))
    }
    data.googleEvents.forEach { e ->
        val date = runCatching { LocalDate.parse(e.startDate) }.getOrNull() ?: return@forEach
        itemsByDay[date]?.add(DayAgendaItem(e.startAt?.let { localTimeLabel(it) }, e.title, e.color, null))
    }
    val sortedItemsByDay = itemsByDay.mapValues { (_, items) ->
        items.sortedWith(compareBy({ it.time != null }, { it.time ?: "" }))
    }

    val context = LocalContext.current

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetStyle.background(opacity))
            .cornerRadius(20.dp)
            .padding(12.dp)
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
    ) {
        Text(
            text = "🗓️ Calendrier",
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetStyle.accent)),
        )
        Text(
            text = if (data.googleConnected) "Taskinator + Google Calendar" else "Taskinator — connecte Google dans les réglages pour fusionner",
            style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetStyle.metaText)),
            maxLines = 1,
        )
        Spacer(modifier = GlanceModifier.size(6.dp))

        Row(modifier = GlanceModifier.fillMaxWidth()) {
            days.forEach { day ->
                DayColumn(day = day, items = sortedItemsByDay[day].orEmpty(), isToday = day == today)
            }
        }
    }
}

@Composable
private fun DayColumn(day: LocalDate, items: List<DayAgendaItem>, isToday: Boolean) {
    Column(modifier = GlanceModifier.defaultWeight().padding(horizontal = 1.dp)) {
        Text(
            text = "${day.dayOfWeek.getDisplayName(JavaTextStyle.NARROW, Locale.FRENCH)}${day.dayOfMonth}",
            style = TextStyle(
                fontSize = 10.sp,
                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                color = ColorProvider(if (isToday) WidgetStyle.accent else WidgetStyle.metaText),
            ),
        )
        Spacer(modifier = GlanceModifier.size(2.dp))
        val shown = items.take(4)
        if (shown.isEmpty()) {
            Text(text = "·", style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetStyle.emptyText)))
        } else {
            shown.forEach { item -> DayAgendaItemView(item) }
            if (items.size > shown.size) {
                Text(
                    text = "+${items.size - shown.size}",
                    style = TextStyle(fontSize = 9.sp, color = ColorProvider(WidgetStyle.metaText)),
                )
            }
        }
    }
}

@Composable
private fun DayAgendaItemView(item: DayAgendaItem) {
    val isTask = item.taskId != null
    val dotColor = if (isTask) WidgetStyle.accent else WidgetStyle.calendarColor(item.color)
    val itemModifier = if (isTask) {
        GlanceModifier.fillMaxWidth().padding(vertical = 1.dp)
            .clickable(actionRunCallback<CalendarCompleteTaskAction>(actionParametersOf(CALENDAR_TASK_ID_KEY to item.taskId!!)))
    } else {
        GlanceModifier.fillMaxWidth().padding(vertical = 1.dp)
    }

    Column(modifier = itemModifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = GlanceModifier.size(5.dp).background(dotColor).cornerRadius(3.dp)) {}
            Spacer(modifier = GlanceModifier.width(3.dp))
            if (item.time != null) {
                Text(text = item.time, style = TextStyle(fontSize = 8.sp, color = ColorProvider(WidgetStyle.metaText)))
            }
        }
        Text(
            text = item.title,
            style = TextStyle(fontSize = 9.sp, color = ColorProvider(WidgetStyle.titleText)),
            maxLines = 2,
        )
    }
}

class CalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CalendarWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        CalendarWidgetRefresh.enqueuePeriodic(context)
        CalendarWidgetRefresh.enqueueOneTime(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        CalendarWidgetRefresh.enqueueOneTime(context)
    }
}
