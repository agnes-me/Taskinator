package com.taskinator.app.widget.tasklist

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.taskinator.app.TaskinatorApplication

/** Fait défiler le filtre de date directement sur le widget (Aujourd'hui → Cette semaine → Tout → …). */
class CycleTaskListFilterAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val app = context.applicationContext as TaskinatorApplication
        val currentPrefs = getAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId)
        val current = currentPrefs[FILTER_SCOPE_KEY]?.ifBlank { null } ?: DEFAULT_FILTER_SCOPE
        val next = nextScope(current)
        updateAppWidgetState(context, PreferencesGlanceStateDefinition, glanceId) { prefs ->
            prefs.toMutablePreferences().apply { this[FILTER_SCOPE_KEY] = next }
        }
        refreshTaskListWidget(context, glanceId, app)
    }
}
