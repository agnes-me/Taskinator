package com.taskinator.app.data.google

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.googleCalendarDataStore by preferencesDataStore(name = "google_calendar")
private val CONNECTED_KEY = booleanPreferencesKey("connected")

/** Simple indicateur « compte Google connecté » — le jeton d'accès lui-même n'est jamais stocké, uniquement redemandé (silencieusement) à chaque rafraîchissement. */
class GoogleCalendarStore(private val context: Context) {
    suspend fun isConnected(): Boolean = context.googleCalendarDataStore.data.first()[CONNECTED_KEY] ?: false

    suspend fun setConnected(connected: Boolean) {
        context.googleCalendarDataStore.edit { it[CONNECTED_KEY] = connected }
    }
}
