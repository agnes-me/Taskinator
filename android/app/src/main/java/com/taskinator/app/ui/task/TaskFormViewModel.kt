package com.taskinator.app.ui.task

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.data.models.Room
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

class TaskFormViewModel(
    private val container: AppContainer,
    private val containerId: String,
    private val taskId: String?,
) : ViewModel() {
    val isEditing = taskId != null

    var title by mutableStateOf("")
        private set
    var description by mutableStateOf("")
        private set
    var priority by mutableStateOf("medium")
        private set
    var dueDate by mutableStateOf<LocalDate?>(null)
        private set
    var selectedRoomId by mutableStateOf<String?>(null)
        private set
    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var isLoading by mutableStateOf(taskId != null)
        private set
    var isSaving by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            rooms = runCatching { container.containerRepository.getRooms(containerId) }.getOrDefault(emptyList())
            if (taskId != null) {
                try {
                    val task = container.taskRepository.getTask(taskId)
                    title = task.title
                    description = task.description.orEmpty()
                    priority = task.priority
                    dueDate = task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                    selectedRoomId = task.rooms?.id
                } catch (e: Exception) {
                    errorMessage = "Impossible de charger la tâche — ${e::class.simpleName}"
                } finally {
                    isLoading = false
                }
            }
        }
    }

    fun onTitleChange(value: String) { title = value }
    fun onDescriptionChange(value: String) { description = value }
    fun onPriorityChange(value: String) { priority = value }
    fun onRoomChange(roomId: String?) { selectedRoomId = roomId }
    fun onDueDateChange(value: LocalDate?) { dueDate = value }

    fun save(onSuccess: () -> Unit) {
        if (title.isBlank()) {
            errorMessage = "Le titre est requis."
            return
        }
        viewModelScope.launch {
            isSaving = true
            errorMessage = null
            try {
                val dueDateStr = dueDate?.format(DateTimeFormatter.ISO_LOCAL_DATE)
                val desc = description.trim().ifBlank { null }
                if (taskId == null) {
                    val userId = container.authRepository.currentUserId()
                    if (userId == null) {
                        errorMessage = "Session expirée — reconnecte-toi."
                        return@launch
                    }
                    container.taskRepository.createTask(containerId, userId, title.trim(), desc, selectedRoomId, priority, dueDateStr)
                } else {
                    container.taskRepository.updateTask(taskId, title.trim(), desc, selectedRoomId, priority, dueDateStr)
                }
                container.scheduleWidgetRefresh()
                onSuccess()
            } catch (e: Exception) {
                errorMessage = "Enregistrement impossible — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
            } finally {
                isSaving = false
            }
        }
    }

    fun delete(onSuccess: () -> Unit) {
        val id = taskId ?: return
        viewModelScope.launch {
            isSaving = true
            errorMessage = null
            try {
                container.taskRepository.deleteTask(id)
                container.scheduleWidgetRefresh()
                onSuccess()
            } catch (e: Exception) {
                errorMessage = "Suppression impossible — ${e::class.simpleName}"
            } finally {
                isSaving = false
            }
        }
    }
}
