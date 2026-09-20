package com.taskinator.app

import android.app.Application
import com.taskinator.app.data.AuthRepository
import com.taskinator.app.data.ContainerRepository
import com.taskinator.app.data.SupabaseHttp
import com.taskinator.app.data.TaskRepository
import com.taskinator.app.data.TokenStore
import com.taskinator.app.widget.WidgetRefreshScheduler

/** Conteneur d'injection manuel, volontairement simple (pas de Hilt) pour un v1 léger. */
class AppContainer(private val app: Application) {
    val tokenStore = TokenStore(app)
    val supabaseHttp = SupabaseHttp(tokenStore)
    val authRepository = AuthRepository(supabaseHttp, tokenStore)
    val containerRepository = ContainerRepository(supabaseHttp)
    val taskRepository = TaskRepository(supabaseHttp)

    /** Demande un rafraîchissement immédiat du widget (après connexion ou complétion d'une tâche). */
    fun scheduleWidgetRefresh() {
        WidgetRefreshScheduler.enqueueOneTime(app)
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
