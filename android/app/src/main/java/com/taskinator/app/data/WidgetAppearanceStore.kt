package com.taskinator.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.widgetAppearanceDataStore by preferencesDataStore(name = "widget_appearance")

/** Opacité du fond sombre des widgets (0 = quasi invisible, 1 = opaque), réglable depuis l'appli. */
object WidgetAppearanceStore {
    private val OPACITY = floatPreferencesKey("widget_background_opacity")
    const val DEFAULT_OPACITY = 0.65f

    fun opacityFlow(context: Context): Flow<Float> =
        context.widgetAppearanceDataStore.data.map { prefs -> prefs[OPACITY] ?: DEFAULT_OPACITY }

    suspend fun currentOpacity(context: Context): Float =
        context.widgetAppearanceDataStore.data.first()[OPACITY] ?: DEFAULT_OPACITY

    suspend fun setOpacity(context: Context, value: Float) {
        context.widgetAppearanceDataStore.edit { prefs -> prefs[OPACITY] = value.coerceIn(0f, 1f) }
    }
}
