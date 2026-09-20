package com.taskinator.app.ui.settings

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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

        val consentLauncher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
            val authResult = app.container.googleAuthManager.resultFromIntent(result.data)
            val granted = authResult != null && !authResult.hasResolution()
            lifecycleScope.launch {
                store.setConnected(granted)
                if (granted) CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                recreate()
            }
        }

        setContent {
            TaskinatorTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ConnectScreen(
                        store = store,
                        onConnect = {
                            lifecycleScope.launch {
                                val result = app.container.googleAuthManager.authorize()
                                if (result.hasResolution()) {
                                    val pendingIntent = result.pendingIntent
                                    if (pendingIntent != null) {
                                        consentLauncher.launch(IntentSenderRequest.Builder(pendingIntent.intentSender).build())
                                    }
                                } else {
                                    store.setConnected(true)
                                    CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                                    recreate()
                                }
                            }
                        },
                        onDisconnect = {
                            lifecycleScope.launch {
                                store.setConnected(false)
                                CalendarWidgetRefresh.enqueueOneTime(this@GoogleCalendarConnectActivity)
                                recreate()
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ConnectScreen(store: GoogleCalendarStore, onConnect: () -> Unit, onDisconnect: () -> Unit) {
    var isConnected by remember { mutableStateOf<Boolean?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        isConnected = store.isConnected()
    }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
            Text("🗓️ Google Calendar", style = MaterialTheme.typography.titleLarge)
            Text(
                "Connecte ton compte Google pour voir tes événements Google Calendar fusionnés avec tes tâches Taskinator dans le widget Calendrier (lecture seule).",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 20.dp),
            )

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
