package com.taskinator.app.data.google

import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

const val CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"

/**
 * Autorisation incrémentale Google (API Identity/Authorization de Play Services), en lecture
 * seule sur Google Calendar. Une fois le consentement donné une première fois (via une Activity),
 * les demandes suivantes se résolvent silencieusement (même depuis un simple Context, ex. un
 * Worker en tâche de fond) sans ré-afficher d'écran de consentement, tant qu'il n'est pas révoqué.
 */
class GoogleAuthManager(context: Context) {
    private val client = Identity.getAuthorizationClient(context)

    suspend fun authorize(): AuthorizationResult = suspendCancellableCoroutine { cont ->
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(CALENDAR_READONLY_SCOPE)))
            .build()
        client.authorize(request)
            .addOnSuccessListener { cont.resume(it) }
            .addOnFailureListener { cont.resumeWithException(it) }
    }

    /** À appeler avec l'Intent reçu dans le callback de résolution du consentement (IntentSenderRequest). */
    fun resultFromIntent(data: Intent?): AuthorizationResult? =
        data?.let { runCatching { client.getAuthorizationResultFromIntent(it) }.getOrNull() }

    /** Jeton d'accès si déjà autorisé, sans afficher aucun écran — pour un rafraîchissement en tâche de fond. */
    suspend fun getAccessTokenSilently(): String? = try {
        val result = authorize()
        if (result.hasResolution()) null else result.accessToken
    } catch (e: Exception) {
        null
    }
}
