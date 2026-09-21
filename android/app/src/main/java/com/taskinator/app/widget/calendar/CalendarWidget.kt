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
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.LocalContext
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
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

@Serializable
data class CalendarWidgetData(
    val tasks: List<TaskItem> = emptyList(),
    val googleEvents: List<MergedGoogleEvent> = emptyList(),
    val googleConnected: Boolean = false,
)

internal val CALENDAR_WIDGET_DATA_KEY = stringPreferencesKey("calendar_widget_data_json")
internal val calendarWidgetJson = Json { ignoreUnknownKeys = true }
internal val CALENDAR_TASK_ID_KEY = ActionParameters.Key<String>("calendar_task_id")

private data class AgendaRow(val date: String, val time: String?, val title: String, val source: String?, val taskId: String?, val color: String? = null)

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

    val rows = buildList {
        data.tasks.forEach { t -> t.dueDate?.let { add(AgendaRow(it, null, t.title, "task", t.id)) } }
        data.googleEvents.forEach { e -> add(AgendaRow(e.startDate, e.startAt, e.title, "google", null, e.color)) }
    }.sortedWith(compareBy({ it.date }, { it.time ?: "" }))
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
            text = if (data.googleConnected) "Taskinator + Google Calendar" else "Taskinator — connecte Google dans l'appli pour fusionner",
            style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetStyle.metaText)),
            maxLines = 1,
        )
        Spacer(modifier = GlanceModifier.size(6.dp))

        if (rows.isEmpty()) {
            Text(text = "Rien de prévu.", style = TextStyle(fontSize = 13.sp, color = ColorProvider(WidgetStyle.emptyText)))
        } else {
            LazyColumn(modifier = GlanceModifier.fillMaxWidth()) {
                items(rows, itemId = { (it.taskId ?: it.title).hashCode().toLong() }) { row ->
                    AgendaRowView(row)
                }
            }
        }
    }
}

@Composable
private fun AgendaRowView(row: AgendaRow) {
    val isTask = row.source == "task"
    val rowModifier = if (isTask && row.taskId != null) {
        GlanceModifier.fillMaxWidth().padding(vertical = 3.dp)
            .clickable(actionRunCallback<CalendarCompleteTaskAction>(actionParametersOf(CALENDAR_TASK_ID_KEY to row.taskId)))
    } else {
        GlanceModifier.fillMaxWidth().padding(vertical = 3.dp)
    }

    Row(modifier = rowModifier, verticalAlignment = Alignment.CenterVertically) {
        if (isTask) {
            Text(text = "✅", style = TextStyle(fontSize = 12.sp))
        } else {
            Box(
                modifier = GlanceModifier.size(10.dp)
                    .background(WidgetStyle.calendarColor(row.color))
                    .cornerRadius(5.dp),
            ) {}
        }
        Spacer(modifier = GlanceModifier.width(6.dp))
        Column {
            Text(text = row.title, style = TextStyle(fontSize = 13.sp, color = ColorProvider(WidgetStyle.titleText)), maxLines = 1)
            Text(text = row.date, style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetStyle.metaText)), maxLines = 1)
        }
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
