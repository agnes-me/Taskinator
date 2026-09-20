package com.taskinator.app

import android.app.Application
import com.taskinator.app.data.AuthRepository
import com.taskinator.app.data.ContainerRepository
import com.taskinator.app.data.SupabaseHttp
import com.taskinator.app.data.TaskRepository
import com.taskinator.app.data.TokenStore
import com.taskinator.app.data.google.GoogleAuthManager
import com.taskinator.app.data.google.GoogleCalendarRepository
import com.taskinator.app.widget.WidgetRefreshScheduler
import com.taskinator.app.widget.calendar.CalendarWidgetRefresh
import com.taskinator.app.widget.tasklist.TaskListWidgetRefresh

/** Conteneur d'injection manuel, volontairement simple (pas de Hilt) pour un v1 léger. */
class AppContainer(private val app: Application) {
    val tokenStore = TokenStore(app)
    val supabaseHttp = SupabaseHttp(tokenStore)
    val authRepository = AuthRepository(supabaseHttp, tokenStore)
    val containerRepository = ContainerRepository(supabaseHttp)
    val taskRepository = TaskRepository(supabaseHttp)
    val googleAuthManager = GoogleAuthManager(app)
    val googleCalendarRepository = GoogleCalendarRepository()

    /** Demande un rafraîchissement immédiat de tous les widgets (après connexion ou complétion d'une tâche). */
    fun scheduleWidgetRefresh() {
        WidgetRefreshScheduler.enqueueOneTime(app)
        TaskListWidgetRefresh.enqueueOneTime(app)
        CalendarWidgetRefresh.enqueueOneTime(app)
    }
}

class TaskinatorApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
