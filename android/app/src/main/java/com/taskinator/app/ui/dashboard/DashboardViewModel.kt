package com.taskinator.app.ui.dashboard

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.data.models.Household
import com.taskinator.app.data.models.TaskItem
import kotlinx.coroutines.launch

class DashboardViewModel(private val container: AppContainer) : ViewModel() {
    private val authRepository = container.authRepository
    private val containerRepository = container.containerRepository
    private val taskRepository = container.taskRepository
    var households by mutableStateOf<List<Household>>(emptyList())
        private set
    var myTasks by mutableStateOf<List<TaskItem>>(emptyList())
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
                val userId = authRepository.currentUserId()
                households = containerRepository.getHouseholds()
                myTasks = if (userId != null) taskRepository.getMyUpcomingTasks(userId) else emptyList()
            } catch (e: Exception) {
                errorMessage = "Impossible de charger tes données — vérifie ta connexion."
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
                myTasks = myTasks.filterNot { it.id == taskId }
                container.scheduleWidgetRefresh()
            } catch (e: Exception) {
                errorMessage = "Impossible de valider cette tâche."
            }
        }
    }
}
