package com.taskinator.app.data

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
data class RoomTemplate(
    val id: String,
    val name: String,
    val icon: String,
    @SerialName("is_system") val isSystem: Boolean,
    val visibility: String,
    @SerialName("moderation_status") val moderationStatus: String,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("owner_container_id") val ownerContainerId: String? = null,
)

@Serializable
private data class NewRoomForTemplateRequest(
    @SerialName("container_id") val containerId: String,
    val name: String,
    val icon: String,
    @SerialName("freshness_days") val freshnessDays: Int,
)

@Serializable
private data class RoomIdOnly(val id: String)

@Serializable
private data class ApplyRoomTemplateRequest(
    @SerialName("p_template_id") val templateId: String,
    @SerialName("p_room_id") val roomId: String,
)

/**
 * Templates de catégorie (système, partagés dans un conteneur, personnels, ou publiés sur la
 * marketplace) — même table (room_templates) et même RPC (apply_room_template) que le web, avec
 * les mêmes règles RLS (room_template_visible/room_template_editable, cf. migration 0001).
 */
class TemplateRepository(private val http: SupabaseHttp) {

    /** Système + partagés dans ce conteneur + personnels + marketplace publique approuvée (même filtre `or` que le web). */
    suspend fun getRoomTemplates(containerId: String): List<RoomTemplate> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/room_templates".toHttpUrl().newBuilder()
            .addQueryParameter("or", "(is_system.eq.true,owner_container_id.eq.$containerId,visibility.eq.public)")
            .addQueryParameter("select", "id,name,icon,is_system,visibility,moderation_status,created_by,owner_container_id")
            .addQueryParameter("order", "is_system.desc")
            .build()
        val request = Request.Builder().url(url).get().build()
        http.client.executeOrThrow(request).use { resp -> json.decodeFromString(resp.body!!.string()) }
    }

    /** Crée une nouvelle catégorie puis y applique le template — combinaison des deux appels que fait le web. */
    suspend fun applyTemplateToNewRoom(containerId: String, templateId: String, roomName: String, roomIcon: String): String =
        withContext(Dispatchers.IO) {
            val insertBody = json.encodeToString(
                NewRoomForTemplateRequest.serializer(),
                NewRoomForTemplateRequest(containerId, roomName, roomIcon, 7),
            )
            val insertRequest = Request.Builder()
                .url("${SupabaseConfig.REST_URL}/rooms")
                .header("Content-Type", "application/json")
                .header("Prefer", "return=representation")
                .post(insertBody.toRequestBody(jsonMedia))
                .build()
            val room = http.client.executeOrThrow(insertRequest).use { resp ->
                json.decodeFromString<List<RoomIdOnly>>(resp.body!!.string()).first()
            }
            applyTemplateToRoom(templateId, room.id)
            room.id
        }

    suspend fun applyTemplateToRoom(templateId: String, roomId: String) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(ApplyRoomTemplateRequest.serializer(), ApplyRoomTemplateRequest(templateId, roomId))
        val request = Request.Builder()
            .url("${SupabaseConfig.REST_URL}/rpc/apply_room_template")
            .header("Content-Type", "application/json")
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }
}
