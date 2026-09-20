package com.taskinator.app.ui.login

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.data.ApiException
import com.taskinator.app.data.AuthRepository
import kotlinx.coroutines.launch

class LoginViewModel(private val authRepository: AuthRepository) : ViewModel() {
    var email by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    fun onEmailChange(value: String) {
        email = value
    }

    fun onPasswordChange(value: String) {
        password = value
    }

    fun signIn(onSuccess: () -> Unit) {
        if (email.isBlank() || password.isBlank()) {
            errorMessage = "Renseigne ton e-mail et ton mot de passe."
            return
        }
        isLoading = true
        errorMessage = null
        viewModelScope.launch {
            try {
                authRepository.signIn(email, password)
                onSuccess()
            } catch (e: ApiException) {
                errorMessage = e.message ?: "Connexion impossible."
            } catch (e: Exception) {
                errorMessage = "Connexion impossible — vérifie ta connexion internet."
            } finally {
                isLoading = false
            }
        }
    }
}
