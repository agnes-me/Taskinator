package com.taskinator.app.widget.tasklist

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.taskinator.app.TaskinatorApplication
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Coche une tâche depuis le widget « Mes tâches », puis rafraîchit sa propre liste. */
class TaskListCompleteTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val taskId = parameters[LIST_TASK_ID_KEY] ?: return
        val app = context.applicationContext as TaskinatorApplication
        val userId = app.container.authRepository.currentUserId() ?: return

        runCatching { app.container.taskRepository.completeTask(taskId, userId) }
        refreshTaskListWidget(context, glanceId, app)
    }
}

/** dueBefore inclusif pour le filtre de date affiché sur le widget — null pour "Tout" (pas de borne). */
private fun dueBeforeFor(scope: String): String? {
    val today = LocalDate.now()
    val fmt = DateTimeFormatter.ISO_LOCAL_DATE
    return when (scope) {
        "today" -> today.format(fmt)
        "week" -> today.plusDays(6).format(fmt)
        else -> null
    }
}

internal suspend fun refreshTaskListWidget(context: Context, glanceId: GlanceId, app: TaskinatorApplication) {
    val currentPrefs = getAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId)
    val containerId = currentPrefs[FILTER_CONTAINER_KEY]?.ifBlank { null }
    val roomId = currentPrefs[FILTER_ROOM_KEY]?.ifBlank { null }
    val scope = currentPrefs[FILTER_SCOPE_KEY]?.ifBlank { null } ?: DEFAULT_FILTER_SCOPE

    val tasks = runCatching { app.container.taskRepository.getFilteredTasks(containerId, roomId, dueBeforeFor(scope)) }.getOrNull() ?: return
    val json = taskListWidgetJson.encodeToString(TaskListWidgetTasks.serializer(), TaskListWidgetTasks(tasks))
    updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
        prefs.toMutablePreferences().apply { this[LIST_TASKS_JSON_KEY] = json }
    }
    TaskListWidget().updateAll(context)
}
