package com.taskinator.app.data

import com.taskinator.app.data.models.NewTaskCompletion
import com.taskinator.app.data.models.TaskItem
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

// encodeDefaults=true : indispensable pour TaskPatch — un champ nullable laissé à null (ex.
// vider la catégorie ou l'échéance d'une tâche) doit être envoyé comme `null` explicite dans le
// PATCH, pas omis (ce qui laisserait la valeur existante inchangée côté PostgREST).
private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
private val jsonMedia = "application/json".toMediaType()

@Serializable
private data class NewTaskRequest(
    val title: String,
    val description: String? = null,
    @SerialName("room_id") val roomId: String? = null,
    val priority: String,
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("container_id") val containerId: String,
    @SerialName("created_by") val createdBy: String,
)

@Serializable
private data class TaskPatch(
    val title: String,
    val description: String? = null,
    @SerialName("room_id") val roomId: String? = null,
    val priority: String,
    @SerialName("due_date") val dueDate: String? = null,
)

class TaskRepository(private val http: SupabaseHttp) {

    /**
     * Mes prochaines tâches (tous mes conteneurs, non terminées, à échéance connue), triées par
     * échéance. Ne filtre plus par assignation nommée (table task_assignees) ni par fenêtre de 7
     * jours : de nombreux foyers n'assignent jamais une tâche à quelqu'un en particulier — un
     * filtre par assigné renvoyait alors systématiquement une liste vide — et une tâche
     * d'événement à échéance dans plusieurs mois est tout autant "à venir" qu'une tâche due
     * demain. userId n'est plus utilisé dans la requête (RLS restreint déjà aux conteneurs dont
     * l'utilisateur est membre) mais reste au signature pour ne pas retoucher tous les appelants.
     */
    suspend fun getMyUpcomingTasks(userId: String): List<TaskItem> = withContext(Dispatchers.IO) {
        val tasksUrl = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("parent_task_id", "is.null")
            .addQueryParameter("status", "not.in.(done,cancelled)")
            .addQueryParameter("due_date", "not.is.null")
            .addQueryParameter("order", "due_date.asc")
            .addQueryParameter("limit", "10")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,containers(name)")
            .build()
        val tasksRequest = Request.Builder().url(tasksUrl).get().build()
        val tasks: List<TaskItem> = http.client.executeOrThrow(tasksRequest).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        tasks
    }

    suspend fun getContainerTasks(containerId: String): List<TaskItem> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("container_id", "eq.$containerId")
            .addQueryParameter("parent_task_id", "is.null")
            .addQueryParameter("status", "not.in.(cancelled)")
            .addQueryParameter("order", "sort_order.asc")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,rooms(id,name,icon)")
            .build()
        val request = Request.Builder().url(url).get().build()
        val tasks: List<TaskItem> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        tasks
    }

    /**
     * Tâches triées par urgence, filtrées par conteneur et/ou catégorie (les deux optionnels), et
     * optionnellement par échéance (dueBefore inclus — sert aussi bien à "en retard" qu'à "cette
     * semaine" puisqu'on ne fixe pas de borne basse, une tâche en retard doit rester visible).
     */
    suspend fun getFilteredTasks(containerId: String?, roomId: String?, dueBefore: String? = null): List<TaskItem> = withContext(Dispatchers.IO) {
        val urlBuilder = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("parent_task_id", "is.null")
            .addQueryParameter("status", "not.in.(done,cancelled)")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,rooms(id,name,icon)")
        if (containerId != null) urlBuilder.addQueryParameter("container_id", "eq.$containerId")
        if (roomId != null) urlBuilder.addQueryParameter("room_id", "eq.$roomId")
        if (dueBefore != null) urlBuilder.addQueryParameter("due_date", "lte.$dueBefore")
        val request = Request.Builder().url(urlBuilder.build()).get().build()
        val tasks: List<TaskItem> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        tasks.sortedWith(taskUrgencyComparator)
    }

    /** Toutes les tâches (tous conteneurs confondus) à échéance dans l'intervalle donné — pour la vue calendrier. */
    suspend fun getTasksInRange(startDate: String, endDate: String): List<TaskItem> = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("parent_task_id", "is.null")
            .addQueryParameter("status", "not.in.(cancelled)")
            .addQueryParameter("due_date", "gte.$startDate")
            .addQueryParameter("due_date", "lte.$endDate")
            .addQueryParameter("order", "due_date.asc")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,containers(name),rooms(id,name,icon)")
            .build()
        val request = Request.Builder().url(url).get().build()
        val tasks: List<TaskItem> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        tasks
    }

    /** Une tâche précise (avec sa catégorie), pour préremplir le formulaire d'édition. */
    suspend fun getTask(taskId: String): TaskItem = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("id", "eq.$taskId")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,containers(name),rooms(id,name,icon)")
            .build()
        val request = Request.Builder().url(url).get().build()
        val tasks: List<TaskItem> = http.client.executeOrThrow(request).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        tasks.first()
    }

    suspend fun createTask(
        containerId: String,
        createdBy: String,
        title: String,
        description: String?,
        roomId: String?,
        priority: String,
        dueDate: String?,
    ) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(
            NewTaskRequest.serializer(),
            NewTaskRequest(title, description, roomId, priority, dueDate, containerId, createdBy),
        )
        val request = Request.Builder()
            .url("${SupabaseConfig.REST_URL}/tasks")
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun updateTask(
        taskId: String,
        title: String,
        description: String?,
        roomId: String?,
        priority: String,
        dueDate: String?,
    ) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(TaskPatch.serializer(), TaskPatch(title, description, roomId, priority, dueDate))
        val url = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder().addQueryParameter("id", "eq.$taskId").build()
        val request = Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .patch(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun deleteTask(taskId: String) = withContext(Dispatchers.IO) {
        val url = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder().addQueryParameter("id", "eq.$taskId").build()
        val request = Request.Builder().url(url).delete().build()
        http.client.executeOrThrow(request).close()
    }

    suspend fun completeTask(taskId: String, userId: String) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(
            NewTaskCompletion.serializer(),
            NewTaskCompletion(taskId = taskId, completedBy = userId),
        )
        val request = Request.Builder()
            .url("${SupabaseConfig.REST_URL}/task_completions")
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.client.executeOrThrow(request).close()
    }
}
