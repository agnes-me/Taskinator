package com.taskinator.app.ui.templates

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.data.RoomTemplate
import com.taskinator.app.data.models.Room
import kotlinx.coroutines.launch

class TemplatesViewModel(private val container: AppContainer, private val containerId: String) : ViewModel() {
    var templates by mutableStateOf<List<RoomTemplate>>(emptyList())
        private set
    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var isLoading by mutableStateOf(true)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var actionMessage by mutableStateOf<String?>(null)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                templates = container.templateRepository.getRoomTemplates(containerId)
                rooms = container.containerRepository.getRooms(containerId)
            } catch (e: Exception) {
                errorMessage = "Impossible de charger la marketplace — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
            } finally {
                isLoading = false
            }
        }
    }

    fun applyToExistingRoom(templateId: String, roomId: String) {
        viewModelScope.launch {
            actionMessage = null
            try {
                container.templateRepository.applyTemplateToRoom(templateId, roomId)
                actionMessage = "✅ Template appliqué !"
            } catch (e: Exception) {
                actionMessage = "Impossible d'appliquer ce template — ${e.message ?: e::class.simpleName}"
            }
        }
    }

    fun applyToNewRoom(templateId: String, roomName: String, roomIcon: String) {
        viewModelScope.launch {
            actionMessage = null
            try {
                container.templateRepository.applyTemplateToNewRoom(containerId, templateId, roomName, roomIcon)
                actionMessage = "✅ Catégorie créée et template appliqué !"
                rooms = container.containerRepository.getRooms(containerId)
            } catch (e: Exception) {
                actionMessage = "Impossible de créer la catégorie — ${e.message ?: e::class.simpleName}"
            }
        }
    }
}
