package com.taskinator.app.widget.calendar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import com.taskinator.app.TaskinatorApplication

/** Coche une tâche Taskinator depuis le widget Calendrier fusionné, puis rafraîchit l'agenda affiché. */
class CalendarCompleteTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val taskId = parameters[CALENDAR_TASK_ID_KEY] ?: return
        val app = context.applicationContext as TaskinatorApplication
        val userId = app.container.authRepository.currentUserId() ?: return

        runCatching { app.container.taskRepository.completeTask(taskId, userId) }
        refreshCalendarWidget(context, app)
    }
}
