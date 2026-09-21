package com.taskinator.app.widget.tasklist

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
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
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
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
import com.taskinator.app.data.models.TaskItem
import com.taskinator.app.widget.WidgetStyle
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class TaskListWidgetTasks(val tasks: List<TaskItem>)

internal val LIST_TASKS_JSON_KEY = stringPreferencesKey("tasklist_tasks_json")
internal val FILTER_CONTAINER_KEY = stringPreferencesKey("tasklist_filter_container_id")
internal val FILTER_CONTAINER_NAME_KEY = stringPreferencesKey("tasklist_filter_container_name")
internal val FILTER_ROOM_KEY = stringPreferencesKey("tasklist_filter_room_id")
internal val FILTER_ROOM_NAME_KEY = stringPreferencesKey("tasklist_filter_room_name")
internal val taskListWidgetJson = Json { ignoreUnknownKeys = true }
internal val LIST_TASK_ID_KEY = ActionParameters.Key<String>("tasklist_task_id")

private val PRIORITY_DOT_COLOR = mapOf(
    "high" to Color(0xFFEF4444),
    "medium" to Color(0xFFF59E0B),
    "low" to Color(0xFF22C55E),
)

class TaskListWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val opacity = WidgetAppearanceStore.currentOpacity(context)
        provideContent {
            TaskListWidgetContent(opacity)
        }
    }
}

@Composable
private fun TaskListWidgetContent(opacity: Float) {
    val prefs = currentState<Preferences>()
    val storedJson = prefs[LIST_TASKS_JSON_KEY]
    val tasks = storedJson
        ?.let { runCatching { taskListWidgetJson.decodeFromString(TaskListWidgetTasks.serializer(), it).tasks }.getOrNull() }
        ?: emptyList()
    val containerName = prefs[FILTER_CONTAINER_NAME_KEY]
    val roomName = prefs[FILTER_ROOM_NAME_KEY]
    val subtitle = listOfNotNull(containerName, roomName).joinToString(" · ").ifBlank { "Tous les conteneurs" }
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
            text = "📋 Mes tâches",
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetStyle.accent)),
        )
        Text(
            text = subtitle,
            style = TextStyle(fontSize = 11.sp, color = ColorProvider(WidgetStyle.metaText)),
        )
        Spacer(modifier = GlanceModifier.size(6.dp))

        if (tasks.isEmpty()) {
            Text(text = "Rien à faire ici.", style = TextStyle(fontSize = 13.sp, color = ColorProvider(WidgetStyle.emptyText)))
        } else {
            LazyColumn(modifier = GlanceModifier.fillMaxWidth()) {
                items(tasks, itemId = { it.id.hashCode().toLong() }) { task ->
                    TaskListWidgetRow(task)
                }
            }
        }
    }
}

@Composable
private fun TaskListWidgetRow(task: TaskItem) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = GlanceModifier
                .size(18.dp)
                .background(WidgetStyle.tapTargetBackground)
                .cornerRadius(5.dp)
                .clickable(actionRunCallback<TaskListCompleteTaskAction>(actionParametersOf(LIST_TASK_ID_KEY to task.id))),
        ) {}
        Spacer(modifier = GlanceModifier.width(6.dp))
        Box(
            modifier = GlanceModifier
                .size(7.dp)
                .background(PRIORITY_DOT_COLOR[task.priority] ?: Color(0xFF94A3B8))
                .cornerRadius(4.dp),
        ) {}
        Spacer(modifier = GlanceModifier.width(6.dp))
        Column {
            Text(text = task.title, style = TextStyle(fontSize = 13.sp, color = ColorProvider(WidgetStyle.titleText)), maxLines = 1)
            val meta = listOfNotNull(task.rooms?.name, task.dueDate).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(text = meta, style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetStyle.metaText)), maxLines = 1)
            }
        }
    }
}

class TaskListWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TaskListWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        TaskListWidgetRefresh.enqueuePeriodic(context)
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        TaskListWidgetRefresh.enqueueOneTime(context)
    }
}
