package com.taskinator.app.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AuthTokenResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Long,
    val user: AuthUser,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String? = null,
)

@Serializable
data class AuthErrorResponse(
    @SerialName("error_description") val errorDescription: String? = null,
    val msg: String? = null,
)

@Serializable
data class Household(
    val id: String,
    val name: String,
    val containers: List<Container> = emptyList(),
)

@Serializable
data class Container(
    val id: String,
    val name: String,
    val icon: String,
    val color: String,
)

@Serializable
data class Room(
    val id: String,
    val name: String,
    val icon: String,
)

@Serializable
data class TaskContainerRef(
    val name: String,
)

@Serializable
data class TaskItem(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String,
    val priority: String,
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("container_id") val containerId: String,
    val containers: TaskContainerRef? = null,
    val rooms: Room? = null,
)

@Serializable
data class TaskAssignee(
    @SerialName("task_id") val taskId: String,
)

@Serializable
data class NewTaskCompletion(
    @SerialName("task_id") val taskId: String,
    @SerialName("completed_by") val completedBy: String,
    val comment: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
)
