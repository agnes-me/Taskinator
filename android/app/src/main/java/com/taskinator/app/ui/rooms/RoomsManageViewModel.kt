package com.taskinator.app.ui.rooms

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.data.models.Room
import kotlinx.coroutines.launch

class RoomsManageViewModel(private val container: AppContainer, private val containerId: String) : ViewModel() {
    var rooms by mutableStateOf<List<Room>>(emptyList())
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
                rooms = container.containerRepository.getRooms(containerId)
            } catch (e: Exception) {
                errorMessage = "Impossible de charger les catégories — ${e::class.simpleName}"
            } finally {
                isLoading = false
            }
        }
    }

    fun createRoom(name: String, icon: String, freshnessDays: Int, onDone: () -> Unit) {
        viewModelScope.launch {
            errorMessage = null
            try {
                container.containerRepository.createRoom(containerId, name.trim(), icon, freshnessDays)
                refresh()
                onDone()
            } catch (e: Exception) {
                errorMessage = "Création impossible — ${e::class.simpleName}"
            }
        }
    }

    fun updateRoom(roomId: String, name: String, icon: String, freshnessDays: Int, onDone: () -> Unit) {
        viewModelScope.launch {
            errorMessage = null
            try {
                container.containerRepository.updateRoom(roomId, name.trim(), icon, freshnessDays)
                refresh()
                onDone()
            } catch (e: Exception) {
                errorMessage = "Modification impossible — ${e::class.simpleName}"
            }
        }
    }

    fun deleteRoom(roomId: String) {
        viewModelScope.launch {
            errorMessage = null
            try {
                container.containerRepository.deleteRoom(roomId)
                refresh()
            } catch (e: Exception) {
                errorMessage = "Suppression impossible — ${e::class.simpleName}"
            }
        }
    }
}
