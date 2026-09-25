package com.taskinator.app.widget.tasklist

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.lifecycle.lifecycleScope
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.models.Container
import com.taskinator.app.data.models.Household
import com.taskinator.app.data.models.Room
import com.taskinator.app.ui.theme.TaskinatorTheme
import kotlinx.coroutines.launch

/** Écran de configuration affiché à la pose du widget « Mes tâches (filtrable) » : choix du conteneur et de la catégorie. */
class TaskListWidgetConfigActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)

        appWidgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val app = application as TaskinatorApplication

        setContent {
            TaskinatorTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ConfigScreen(
                        app = app,
                        onConfirm = { containerId, containerName, roomId, roomName ->
                            lifecycleScope.launch {
                                saveAndFinish(app, containerId, containerName, roomId, roomName)
                            }
                        },
                    )
                }
            }
        }
    }

    private suspend fun saveAndFinish(app: TaskinatorApplication, containerId: String?, containerName: String?, roomId: String?, roomName: String?) {
        val glanceId = GlanceAppWidgetManager(this).getGlanceIdBy(appWidgetId)
        updateAppWidgetState(this, PreferencesGlanceStateDefinition, glanceId) { prefs ->
            prefs.toMutablePreferences().apply {
                this[FILTER_CONTAINER_KEY] = containerId.orEmpty()
                this[FILTER_CONTAINER_NAME_KEY] = containerName.orEmpty()
                this[FILTER_ROOM_KEY] = roomId.orEmpty()
                this[FILTER_ROOM_NAME_KEY] = roomName.orEmpty()
            }
        }
        refreshTaskListWidget(this, glanceId, app)

        val resultValue = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        setResult(Activity.RESULT_OK, resultValue)
        finish()
    }
}

@androidx.compose.runtime.Composable
private fun ConfigScreen(app: TaskinatorApplication, onConfirm: (String?, String?, String?, String?) -> Unit) {
    var households by remember { mutableStateOf<List<Household>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedContainer by remember { mutableStateOf<Container?>(null) }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var selectedRoom by remember { mutableStateOf<Room?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        households = runCatching { app.container.containerRepository.getHouseholds() }.getOrDefault(emptyList())
        isLoading = false
    }

    androidx.compose.runtime.LaunchedEffect(selectedContainer) {
        val container = selectedContainer
        rooms = if (container != null) {
            runCatching { app.container.containerRepository.getRooms(container.id) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
        selectedRoom = null
    }

    Scaffold { padding ->
        if (isLoading) {
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Text("Configurer le widget", style = MaterialTheme.typography.titleLarge)
            Text(
                "Choisis quel conteneur (et, si tu veux, quelle catégorie) afficher — les tâches seront triées par importance puis par date.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )

            Text("Conteneur", style = MaterialTheme.typography.labelLarge)
            LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 260.dp)) {
                item {
                    SelectableRow(
                        label = "🗂️ Tous les conteneurs",
                        selected = selectedContainer == null,
                        onClick = { selectedContainer = null },
                    )
                }
                households.forEach { household ->
                    items(household.containers) { container ->
                        SelectableRow(
                            label = "${container.icon} ${container.name}",
                            selected = selectedContainer?.id == container.id,
                            onClick = { selectedContainer = container },
                        )
                    }
                }
            }

            if (selectedContainer != null) {
                Text("Catégorie", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 12.dp))
                SelectableRow(
                    label = "Toutes les catégories",
                    selected = selectedRoom == null,
                    onClick = { selectedRoom = null },
                )
                rooms.forEach { room ->
                    SelectableRow(
                        label = "${room.icon} ${room.name}",
                        selected = selectedRoom?.id == room.id,
                        onClick = { selectedRoom = room },
                    )
                }
            }

            Button(
                onClick = {
                    onConfirm(
                        selectedContainer?.id,
                        selectedContainer?.name,
                        selectedRoom?.id,
                        selectedRoom?.name,
                    )
                },
                modifier = Modifier.padding(top = 16.dp),
            ) {
                Text("Ajouter le widget")
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun SelectableRow(label: String, selected: Boolean, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Text(label)
    }
}
