package com.taskinator.app.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "taskinator_session")

/**
 * Stockage de session non chiffré (DataStore) pour rester sur une API 100% stable en v1.
 * À durcir avec androidx.security-crypto (Keystore) avant une mise en production réelle.
 */
class TokenStore(private val context: Context) {
    private object Keys {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val USER_EMAIL = stringPreferencesKey("user_email")
    }

    data class Session(val accessToken: String, val refreshToken: String, val userId: String, val userEmail: String?)

    val sessionFlow: Flow<Session?> = context.dataStore.data.map { prefs -> prefs.toSessionOrNull() }

    suspend fun currentSession(): Session? = context.dataStore.data.first().toSessionOrNull()

    private fun Preferences.toSessionOrNull(): Session? {
        val access = this[Keys.ACCESS_TOKEN] ?: return null
        val refresh = this[Keys.REFRESH_TOKEN] ?: return null
        val userId = this[Keys.USER_ID] ?: return null
        return Session(access, refresh, userId, this[Keys.USER_EMAIL])
    }

    suspend fun save(accessToken: String, refreshToken: String, userId: String, userEmail: String?) {
        context.dataStore.edit { prefs ->
            prefs[Keys.ACCESS_TOKEN] = accessToken
            prefs[Keys.REFRESH_TOKEN] = refreshToken
            prefs[Keys.USER_ID] = userId
            if (userEmail != null) prefs[Keys.USER_EMAIL] = userEmail
        }
    }

    suspend fun updateAccessToken(accessToken: String, refreshToken: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.ACCESS_TOKEN] = accessToken
            prefs[Keys.REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
