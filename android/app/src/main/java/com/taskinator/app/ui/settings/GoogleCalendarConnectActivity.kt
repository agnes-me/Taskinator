package com.taskinator.app.ui.settings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.google.GoogleCalendarStore
import com.taskinator.app.ui.theme.TaskinatorTheme
import com.taskinator.app.widget.calendar.CalendarWidgetRefresh
import kotlinx.coroutines.launch

/** Écran de connexion/déconnexion à Google Calendar, pour le widget Calendrier fusionné. */
class GoogleCalendarConnectActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as TaskinatorApplication
        val store = GoogleCalendarStore(this)

        setContent {
            TaskinatorTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var isConnected by remember { mutableStateOf<Boolean?>(null) }
                    var errorMessage by remember { mutableStateOf<String?>(null) }

                    LaunchedEffect(Unit) {
                        isConnected = store.isConnected()
                    }

                    val consentLauncher = rememberLauncherForActivityResult(
                        ActivityResultContracts.StartIntentSenderForResult(),
                    ) { result ->
                        lifecycleScope.launch {
                            try {
                                val authResult = app.container.googleAuthManager.resultFromIntent(result.data)
                                val granted = authResult != null && !authResult.hasResolution()
                                store.setConnected(granted)
                                if (granted) {
                                    CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                                    errorMessage = null
                                } else {
                                    errorMessage = "Consentement Google non finalisé (code résultat ${result.resultCode}). " +
                                        "Vérifie que ton compte Gmail est bien ajouté comme « utilisateur test » dans " +
                                        "l'écran de consentement OAuth de Google Cloud Console (voir le README)."
                                }
                                isConnected = granted
                            } catch (e: Exception) {
                                errorMessage = "Erreur Google — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
                                isConnected = false
                            }
                        }
                    }

                    ConnectScreen(
                        isConnected = isConnected,
                        errorMessage = errorMessage,
                        onConnect = {
                            errorMessage = null
                            lifecycleScope.launch {
                                try {
                                    val result = app.container.googleAuthManager.authorize()
                                    if (result.hasResolution()) {
                                        val pendingIntent = result.pendingIntent
                                        if (pendingIntent != null) {
                                            consentLauncher.launch(IntentSenderRequest.Builder(pendingIntent.intentSender).build())
                                        } else {
                                            errorMessage = "Google n'a pas fourni d'écran de consentement (pendingIntent nul)."
                                        }
                                    } else {
                                        store.setConnected(true)
                                        CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                                        isConnected = true
                                    }
                                } catch (e: Exception) {
                                    errorMessage = "Erreur Google — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
                                }
                            }
                        },
                        onDisconnect = {
                            lifecycleScope.launch {
                                store.setConnected(false)
                                CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                                isConnected = false
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ConnectScreen(
    isConnected: Boolean?,
    errorMessage: String?,
    onConnect: () -> Unit,
    onDisconnect: () -> Unit,
) {
    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
            Text("🗓️ Google Calendar", style = MaterialTheme.typography.titleLarge)
            Text(
                "Connecte ton compte Google pour voir tes événements Google Calendar fusionnés avec tes tâches Taskinator dans le widget Calendrier (lecture seule).",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 20.dp),
            )

            if (errorMessage != null) {
                Text(
                    errorMessage,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
            }

            when (isConnected) {
                null -> CircularProgressIndicator()
                true -> {
                    Text("✅ Connecté", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(bottom = 12.dp))
                    Button(onClick = onDisconnect) { Text("Déconnecter") }
                }
                false -> Button(onClick = onConnect) { Text("Connecter Google Calendar") }
            }
        }
    }
}
