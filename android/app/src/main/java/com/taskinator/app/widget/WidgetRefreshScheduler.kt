package com.taskinator.app.widget

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object WidgetRefreshScheduler {
    private const val PERIODIC_NAME = "taskinator_widget_refresh_periodic"
    private const val ONE_TIME_NAME = "taskinator_widget_refresh_once"

    fun enqueuePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<TaskinatorWidgetWorker>(30, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun enqueueOneTime(context: Context) {
        val request = OneTimeWorkRequestBuilder<TaskinatorWidgetWorker>().build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request)
    }
}
