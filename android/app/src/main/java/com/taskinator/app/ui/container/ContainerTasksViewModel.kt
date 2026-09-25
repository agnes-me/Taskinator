package com.taskinator.app.ui.container

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.data.models.TaskItem
import kotlinx.coroutines.launch

class ContainerTasksViewModel(private val containerId: String, private val container: AppContainer) : ViewModel() {
    private val taskRepository = container.taskRepository
    private val authRepository = container.authRepository
    var tasks by mutableStateOf<List<TaskItem>>(emptyList())
        private set
    var isLoading by mutableStateOf(true)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                tasks = taskRepository.getContainerTasks(containerId)
            } catch (e: Exception) {
                errorMessage = "Impossible de charger les tâches."
            } finally {
                isLoading = false
            }
        }
    }

    fun completeTask(taskId: String) {
        viewModelScope.launch {
            val userId = authRepository.currentUserId() ?: return@launch
            try {
                taskRepository.completeTask(taskId, userId)
                container.scheduleWidgetRefresh()
                refresh()
            } catch (e: Exception) {
                errorMessage = "Impossible de valider cette tâche."
            }
        }
    }
}
