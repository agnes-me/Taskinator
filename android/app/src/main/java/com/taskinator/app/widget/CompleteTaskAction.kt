package com.taskinator.app.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.update
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.taskinator.app.TaskinatorApplication

/** Coche une tâche directement depuis le widget, sans ouvrir l'appli, puis rafraîchit la liste affichée. */
class CompleteTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val taskId = parameters[TASK_ID_KEY] ?: return
        val app = context.applicationContext as TaskinatorApplication
        val userId = app.container.authRepository.currentUserId() ?: return

        runCatching { app.container.taskRepository.completeTask(taskId, userId) }

        val freshTasks = runCatching { app.container.taskRepository.getMyUpcomingTasks(userId) }.getOrNull() ?: return
        val json = widgetJson.encodeToString(WidgetTaskList.serializer(), WidgetTaskList(freshTasks))
        updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
            prefs.toMutablePreferences().apply { this[TASKS_STATE_KEY] = json }
        }
        TaskinatorWidget().update(context, glanceId)
    }
}
