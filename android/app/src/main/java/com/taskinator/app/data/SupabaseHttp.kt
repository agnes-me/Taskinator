package com.taskinator.app.data

import com.taskinator.app.data.models.AuthErrorResponse
import com.taskinator.app.data.models.AuthTokenResponse
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val code: Int, message: String) : IOException(message)

@Serializable
private data class PasswordSignInRequest(val email: String, val password: String)

@Serializable
private data class RefreshTokenRequest(@SerialName("refresh_token") val refreshToken: String)

private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
private val jsonMedia = "application/json".toMediaType()

/**
 * Client HTTP minimal vers Supabase (Auth + PostgREST), sans le SDK officiel.
 * Rafraîchit automatiquement le token d'accès expiré (401) puis rejoue la requête une fois.
 */
class SupabaseHttp(private val tokenStore: TokenStore) {

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val session = runBlocking { tokenStore.currentSession() }
        val builder = original.newBuilder()
            .header("apikey", SupabaseConfig.ANON_KEY)
        if (session != null && original.header("X-Skip-Auth") == null) {
            builder.header("Authorization", "Bearer ${session.accessToken}")
        }
        builder.removeHeader("X-Skip-Auth")
        chain.proceed(builder.build())
    }

    private val refreshInterceptor = Interceptor { chain ->
        val response = chain.proceed(chain.request())
        if (response.code != 401 || chain.request().header("X-Skip-Auth") != null) {
            return@Interceptor response
        }
        val session = runBlocking { tokenStore.currentSession() } ?: return@Interceptor response
        response.close()

        val refreshed = runBlocking { refreshSessionBlocking(session.refreshToken) }
        if (refreshed == null) {
            return@Interceptor chain.proceed(chain.request())
        }
        runBlocking { tokenStore.updateAccessToken(refreshed.accessToken, refreshed.refreshToken) }
        val retried = chain.request().newBuilder()
            .header("Authorization", "Bearer ${refreshed.accessToken}")
            .build()
        chain.proceed(retried)
    }

    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(refreshInterceptor)
        .build()

    // Client sans intercepteur d'auth, pour les appels /auth/v1/token eux-mêmes.
    private val rawClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private suspend fun refreshSessionBlocking(refreshToken: String): AuthTokenResponse? = try {
        signInWithRefreshToken(refreshToken)
    } catch (e: Exception) {
        null
    }

    suspend fun signInWithPassword(email: String, password: String): AuthTokenResponse {
        val body = json.encodeToString(PasswordSignInRequest.serializer(), PasswordSignInRequest(email, password))
        val request = Request.Builder()
            .url("${SupabaseConfig.AUTH_URL}/token?grant_type=password")
            .header("apikey", SupabaseConfig.ANON_KEY)
            .post(body.toRequestBody(jsonMedia))
            .build()
        return executeAuth(request)
    }

    private suspend fun signInWithRefreshToken(refreshToken: String): AuthTokenResponse {
        val body = json.encodeToString(RefreshTokenRequest.serializer(), RefreshTokenRequest(refreshToken))
        val request = Request.Builder()
            .url("${SupabaseConfig.AUTH_URL}/token?grant_type=refresh_token")
            .header("apikey", SupabaseConfig.ANON_KEY)
            .post(body.toRequestBody(jsonMedia))
            .build()
        return executeAuth(request)
    }

    private fun executeAuth(request: Request): AuthTokenResponse {
        rawClient.newCall(request).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val message = runCatching { json.decodeFromString<AuthErrorResponse>(bodyStr) }
                    .getOrNull()
                    ?.let { it.errorDescription ?: it.msg }
                    ?: "Erreur d'authentification (${resp.code})"
                throw ApiException(resp.code, message)
            }
            return json.decodeFromString(bodyStr)
        }
    }
}

/** Exécute une requête REST déjà construite (headers apikey/Authorization ajoutés par l'intercepteur) et lève en cas d'échec. */
fun OkHttpClient.executeOrThrow(request: Request): Response {
    val response = newCall(request).execute()
    if (!response.isSuccessful) {
        val message = response.body?.string().orEmpty().ifBlank { "Erreur réseau (${response.code})" }
        response.close()
        throw ApiException(response.code, message)
    }
    return response
}
