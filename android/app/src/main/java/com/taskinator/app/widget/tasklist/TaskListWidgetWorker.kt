package com.taskinator.app.widget.tasklist

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.taskinator.app.TaskinatorApplication
import java.util.concurrent.TimeUnit

/** Rafraîchit chaque instance posée du widget « Mes tâches (filtrable) », avec ses propres filtres. */
class TaskListWidgetWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as TaskinatorApplication
        val manager = GlanceAppWidgetManager(applicationContext)
        val glanceIds = manager.getGlanceIds(TaskListWidget::class.java)
        for (glanceId in glanceIds) {
            refreshTaskListWidget(applicationContext, glanceId, app)
        }
        return Result.success()
    }
}

object TaskListWidgetRefresh {
    private const val ONE_TIME_NAME = "taskinator_tasklist_widget_refresh"
    private const val PERIODIC_NAME = "taskinator_tasklist_widget_refresh_periodic"

    fun enqueueOneTime(context: Context) {
        val request = OneTimeWorkRequestBuilder<TaskListWidgetWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun enqueuePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<TaskListWidgetWorker>(30, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
