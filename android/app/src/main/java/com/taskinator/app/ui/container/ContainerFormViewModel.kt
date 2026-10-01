package com.taskinator.app.ui.container

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.AppContainer
import com.taskinator.app.ui.IconPalette
import kotlinx.coroutines.launch

class ContainerFormViewModel(
    private val container: AppContainer,
    private val householdId: String?,
    private val containerId: String?,
) : ViewModel() {
    val isEditing = containerId != null

    var name by mutableStateOf("")
        private set
    var icon by mutableStateOf(IconPalette.CONTAINER_ICONS.first())
        private set
    var color by mutableStateOf(IconPalette.CONTAINER_COLORS.first())
        private set
    var isLoading by mutableStateOf(containerId != null)
        private set
    var isSaving by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    init {
        if (containerId != null) {
            viewModelScope.launch {
                try {
                    val existing = container.containerRepository.getContainer(containerId)
                    name = existing.name
                    icon = existing.icon
                    color = existing.color
                } catch (e: Exception) {
                    errorMessage = "Impossible de charger le conteneur — ${e::class.simpleName}"
                } finally {
                    isLoading = false
                }
            }
        }
    }

    fun onNameChange(value: String) { name = value }
    fun onIconChange(value: String) { icon = value }
    fun onColorChange(value: String) { color = value }

    fun save(onSuccess: (newContainerId: String?) -> Unit) {
        if (name.isBlank()) {
            errorMessage = "Le nom est requis."
            return
        }
        viewModelScope.launch {
            isSaving = true
            errorMessage = null
            try {
                if (containerId == null) {
                    val hid = householdId
                    if (hid == null) {
                        errorMessage = "Foyer inconnu."
                        return@launch
                    }
                    val newId = container.containerRepository.createContainer(hid, name.trim(), icon, color)
                    onSuccess(newId)
                } else {
                    container.containerRepository.updateContainer(containerId, name.trim(), icon, color)
                    onSuccess(null)
                }
            } catch (e: Exception) {
                errorMessage = "Enregistrement impossible — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
            } finally {
                isSaving = false
            }
        }
    }
}
