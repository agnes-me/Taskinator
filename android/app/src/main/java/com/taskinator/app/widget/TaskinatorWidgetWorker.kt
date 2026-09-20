package com.taskinator.app.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.taskinator.app.TaskinatorApplication

/** Rafraîchit périodiquement les données du widget en arrière-plan (toutes les 30 min). */
class TaskinatorWidgetWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as TaskinatorApplication
        val userId = app.container.authRepository.currentUserId() ?: return Result.success()
        val tasks = runCatching { app.container.taskRepository.getMyUpcomingTasks(userId) }.getOrNull()
            ?: return Result.retry()
        val json = widgetJson.encodeToString(WidgetTaskList.serializer(), WidgetTaskList(tasks))

        val manager = GlanceAppWidgetManager(applicationContext)
        val glanceIds = manager.getGlanceIds(TaskinatorWidget::class.java)
        for (glanceId in glanceIds) {
            updateAppWidgetState(applicationContext, PreferencesGlanceStateDefinition, glanceId) { prefs ->
                prefs.toMutablePreferences().apply { this[TASKS_STATE_KEY] = json }
            }
        }
        TaskinatorWidget().updateAll(applicationContext)
        return Result.success()
    }
}
