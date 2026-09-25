package com.taskinator.app.data

import com.taskinator.app.data.models.Household
import com.taskinator.app.data.models.Room
import com.taskinator.app.data.models.Container
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

private val json = Json { ignoreUnknownKeys = true }
private val jsonMedia = "application/json".toMediaType()

@Serializable
private data class CreateContainerRpcRequest(
    @SerialName("p_household_id") val householdId: String,
    @SerialName("p_name") val name: String,
    @SerialName("p_icon") val icon: String,
    @SerialName("p_color") val color: String,
)

@Serializable
private data class ContainerPatch(val name: String, val icon: String, val color: String)

@Serializable
private data class NewRoomRequest(
    @SerialName("container_id") val containerId: String,
    val name: String,
    val icon: String,
    @SerialName("freshness_days") val freshnessDays: Int,
)

@Serializable
private data class RoomPatch(val name: String, val icon: String, @SerialName("freshness_days") val freshnessDays: Int)

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

    suspend fun getContainer(containerId: String): Container = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/containers".toHttpUrl().newBuilder()
            .addQueryParameter("id", "eq.$containerId")
            .addQueryParameter("select", "id,name,icon,color")
            .build()
        val request = Request.Builder().url(url).get().build()
        val containers: List<Container> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        containers.first()
    }

    /** Passe par la fonction RPC create_container (comme le web) : un insert direct sur `containers`
     * laisserait le créateur sans ligne `container_members`, la fonction fait les deux de façon atomique. */
    suspend fun createContainer(householdId: String, name: String, icon: String, color: String): String = withContext(Dispatchers.IO) {
        val body = json.encodeToString(CreateContainerRpcRequest.serializer(), CreateContainerRpcRequest(householdId, name, icon, color))
        val request = Request.Builder()
            .url("${SupabaseConfig.REST_URL}/rpc/create_container")
            .header("Content-Type", "application/json")
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).use { resp -> json.decodeFromString<String>(resp.body!!.string()) }
    }

    suspend fun updateContainer(containerId: String, name: String, icon: String, color: String) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ContainerPatch.serializer(), ContainerPatch(name, icon, color))
        val url = "${SupabaseConfig.REST_URL}/containers".toHttpUrl().newBuilder().addQueryParameter("id", "eq.$containerId").build()
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .patch(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun getRooms(containerId: String): List<Room> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/rooms".toHttpUrl().newBuilder()
            .addQueryParameter("container_id", "eq.$containerId")
            .addQueryParameter("select", "id,name,icon,freshness_days")
            .addQueryParameter("order", "sort_order.asc")
            .build()
        val request = Request.Builder().url(url).get().build()
        val rooms: List<Room> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        rooms
    }

    suspend fun createRoom(containerId: String, name: String, icon: String, freshnessDays: Int) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(NewRoomRequest.serializer(), NewRoomRequest(containerId, name, icon, freshnessDays))
        val request = Request.Builder()
            .url("${SupabaseConfig.REST_URL}/rooms")
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun updateRoom(roomId: String, name: String, icon: String, freshnessDays: Int) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(RoomPatch.serializer(), RoomPatch(name, icon, freshnessDays))
        val url = "${SupabaseConfig.REST_URL}/rooms".toHttpUrl().newBuilder().addQueryParameter("id", "eq.$roomId").build()
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .patch(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun deleteRoom(roomId: String) = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/rooms".toHttpUrl().newBuilder().addQueryParameter("id", "eq.$roomId").build()
        val request = Request.Builder().url(url).delete().build()
        http.client.executeOrThrow(request).close()
    }
}
