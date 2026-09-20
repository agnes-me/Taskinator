package com.taskinator.app.data

import com.taskinator.app.data.models.Household
import com.taskinator.app.data.models.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request

private val json = Json { ignoreUnknownKeys = true }

class ContainerRepository(private val http: SupabaseHttp) {

    suspend fun getHouseholds(): List<Household> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/households".toHttpUrl().newBuilder()
            .addQueryParameter("select", "id,name,containers(id,name,icon,color)")
            .addQueryParameter("order", "created_at.asc")
            .build()
        val request = Request.Builder().url(url).get().build()
        val households: List<Household> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        households
    }

    suspend fun getRooms(containerId: String): List<Room> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/rooms".toHttpUrl().newBuilder()
            .addQueryParameter("container_id", "eq.$containerId")
            .addQueryParameter("select", "id,name,icon")
            .addQueryParameter("order", "sort_order.asc")
            .build()
        val request = Request.Builder().url(url).get().build()
        val rooms: List<Room> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        rooms
    }
}
