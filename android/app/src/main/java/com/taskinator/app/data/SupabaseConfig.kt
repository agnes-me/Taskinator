package com.taskinator.app.data

import com.taskinator.app.BuildConfig

object SupabaseConfig {
    const val URL: String = BuildConfig.SUPABASE_URL
    const val ANON_KEY: String = BuildConfig.SUPABASE_ANON_KEY
    const val AUTH_URL: String = "$URL/auth/v1"
    const val REST_URL: String = "$URL/rest/v1"
}
