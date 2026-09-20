package com.taskinator.app.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
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
import com.taskinator.app.data.models.TaskItem
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class WidgetTaskList(val tasks: List<TaskItem>)

internal val TASKS_STATE_KEY = stringPreferencesKey("widget_tasks_json")
internal val widgetJson = Json { ignoreUnknownKeys = true }
internal val TASK_ID_KEY = ActionParameters.Key<String>("task_id")

class TaskinatorWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            WidgetContent()
        }
    }
}

@Composable
private fun WidgetContent() {
    val prefs = currentState<Preferences>()
    val storedJson = prefs[TASKS_STATE_KEY]
    val tasks = storedJson
        ?.let { runCatching { widgetJson.decodeFromString(WidgetTaskList.serializer(), it).tasks }.getOrNull() }
        ?: emptyList()

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(Color(0xFFFFFFFF))
            .cornerRadius(20.dp)
            .padding(12.dp)
            .clickable(actionStartActivity(MainActivity::class.java)),
    ) {
        Text(
            text = "✅ Mes tâches",
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ColorProvider(Color(0xFF0D9488))),
        )
        Spacer(modifier = GlanceModifier.size(8.dp))

        if (tasks.isEmpty()) {
            Text(text = "Rien de prévu — bravo !", style = TextStyle(fontSize = 13.sp, color = ColorProvider(Color(0xFF64748B))))
        } else {
            LazyColumn(modifier = GlanceModifier.fillMaxWidth()) {
                items(tasks, itemId = { it.id.hashCode().toLong() }) { task ->
                    WidgetTaskRow(task)
                }
            }
        }
    }
}

@Composable
private fun WidgetTaskRow(task: TaskItem) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = GlanceModifier
                .size(20.dp)
                .background(Color(0xFFF1F5F9))
                .cornerRadius(6.dp)
                .clickable(actionRunCallback<CompleteTaskAction>(actionParametersOf(TASK_ID_KEY to task.id))),
        ) {}
        Spacer(modifier = GlanceModifier.width(8.dp))
        Text(
            text = task.title,
            style = TextStyle(fontSize = 13.sp, color = ColorProvider(Color(0xFF0F172A))),
            maxLines = 1,
        )
    }
}

class TaskinatorWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TaskinatorWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetRefreshScheduler.enqueuePeriodic(context)
        WidgetRefreshScheduler.enqueueOneTime(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        WidgetRefreshScheduler.enqueueOneTime(context)
    }
}
