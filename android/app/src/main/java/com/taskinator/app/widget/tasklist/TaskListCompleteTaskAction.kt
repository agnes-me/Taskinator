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

/** Coche une tâche depuis le widget « Mes tâches (filtrable) », puis rafraîchit sa propre liste. */
class TaskListCompleteTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val taskId = parameters[LIST_TASK_ID_KEY] ?: return
        val app = context.applicationContext as TaskinatorApplication
        val userId = app.container.authRepository.currentUserId() ?: return

        runCatching { app.container.taskRepository.completeTask(taskId, userId) }
        refreshTaskListWidget(context, glanceId, app)
    }
}

internal suspend fun refreshTaskListWidget(context: Context, glanceId: GlanceId, app: TaskinatorApplication) {
    val currentPrefs = getAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId)
    val containerId = currentPrefs[FILTER_CONTAINER_KEY]?.ifBlank { null }
    val roomId = currentPrefs[FILTER_ROOM_KEY]?.ifBlank { null }

    val tasks = runCatching { app.container.taskRepository.getFilteredTasks(containerId, roomId) }.getOrNull() ?: return
    val json = taskListWidgetJson.encodeToString(TaskListWidgetTasks.serializer(), TaskListWidgetTasks(tasks))
    updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
        prefs.toMutablePreferences().apply { this[LIST_TASKS_JSON_KEY] = json }
    }
    TaskListWidget().updateAll(context)
}
