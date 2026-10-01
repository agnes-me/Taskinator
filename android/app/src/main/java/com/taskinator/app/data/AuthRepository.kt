package com.taskinator.app.data

class AuthRepository(private val http: SupabaseHttp, private val tokenStore: TokenStore) {

    val sessionFlow = tokenStore.sessionFlow

    suspend fun signIn(email: String, password: String) {
        val response = http.signInWithPassword(email.trim(), password)
        tokenStore.save(
            accessToken = response.accessToken,
            refreshToken = response.refreshToken,
            userId = response.user.id,
            userEmail = response.user.email,
        )
    }

    suspend fun signOut() {
        tokenStore.clear()
    }

    suspend fun currentUserId(): String? = tokenStore.currentSession()?.userId
}
