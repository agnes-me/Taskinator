package com.taskinator.app.data

import com.taskinator.app.data.models.NewTaskCompletion
import com.taskinator.app.data.models.TaskAssignee
import com.taskinator.app.data.models.TaskItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val json = Json { ignoreUnknownKeys = true }
private val jsonMedia = "application/json".toMediaType()

class TaskRepository(private val http: SupabaseHttp) {

    /** Mes tâches assignées, non terminées, à échéance dans les 7 prochains jours — reflète getMyUpcomingTasks côté web. */
    suspend fun getMyUpcomingTasks(userId: String): List<TaskItem> = withContext(Dispatchers.IO) {
        val assigneeUrl = "${SupabaseConfig.REST_URL}/task_assignees".toHttpUrl().newBuilder()
            .addQueryParameter("user_id", "eq.$userId")
            .addQueryParameter("select", "task_id")
            .build()
        val assigneeRequest = Request.Builder().url(assigneeUrl).get().build()
        val taskIds: List<TaskAssignee> = http.client.executeOrThrow(assigneeRequest).use { resp ->
            json.decodeFromString(resp.body!!.string())
        }
        if (taskIds.isEmpty()) return@withContext emptyList()

        val idsFilter = "(" + taskIds.joinToString(",") { it.taskId } + ")"
        val maxDue = LocalDate.now().plusDays(7).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tasksUrl = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("id", "in.$idsFilter")
            .addQueryParameter("status", "not.in.(done,cancelled)")
            .addQueryParameter("due_date", "lte.$maxDue")
            .addQueryParameter("order", "due_date.asc")
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

    /** Tâches triées par urgence, filtrées par conteneur et/ou catégorie (les deux optionnels). */
    suspend fun getFilteredTasks(containerId: String?, roomId: String?): List<TaskItem> = withContext(Dispatchers.IO) {
        val urlBuilder = "${SupabaseConfig.REST_URL}/tasks".toHttpUrl().newBuilder()
            .addQueryParameter("parent_task_id", "is.null")
            .addQueryParameter("status", "not.in.(done,cancelled)")
            .addQueryParameter("select", "id,title,description,status,priority,due_date,container_id,rooms(id,name,icon)")
        if (containerId != null) urlBuilder.addQueryParameter("container_id", "eq.$containerId")
        if (roomId != null) urlBuilder.addQueryParameter("room_id", "eq.$roomId")
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
