package com.taskinator.app.ui.dashboard

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.models.Container
import com.taskinator.app.data.models.Household
import com.taskinator.app.data.models.TaskItem
import com.taskinator.app.ui.SimpleViewModelFactory
import com.taskinator.app.ui.settings.GoogleCalendarConnectActivity
import com.taskinator.app.ui.settings.WidgetAppearanceActivity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    app: TaskinatorApplication,
    onOpenContainer: (Household, Container) -> Unit,
    onOpenCalendar: () -> Unit,
    onNewContainer: (householdId: String) -> Unit,
    onEditContainer: (containerId: String) -> Unit,
    onSignedOut: () -> Unit,
) {
    val viewModel: DashboardViewModel = viewModel(
        factory = SimpleViewModelFactory { DashboardViewModel(app.container) },
    )
    val context = LocalContext.current

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Taskinator") },
                actions = {
                    IconButton(onClick = onOpenCalendar) {
                        Icon(Icons.Filled.DateRange, contentDescription = "Vue calendrier")
                    }
                    IconButton(onClick = { context.startActivity(Intent(context, GoogleCalendarConnectActivity::class.java)) }) {
                        Icon(Icons.Filled.CalendarMonth, contentDescription = "Connecter Google Calendar")
                    }
                    IconButton(onClick = { context.startActivity(Intent(context, WidgetAppearanceActivity::class.java)) }) {
                        Icon(Icons.Filled.Palette, contentDescription = "Apparence des widgets")
                    }
                    IconButton(onClick = { viewModel.signOut(onSignedOut) }) {
                        Icon(Icons.Filled.Logout, contentDescription = "Se déconnecter")
                    }
                },
            )
        },
    ) { padding ->
        if (viewModel.isLoading && viewModel.households.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (viewModel.errorMessage != null) {
                item {
                    Text(viewModel.errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 12.dp))
                }
            }

            if (viewModel.myTasks.isNotEmpty()) {
                item {
                    Text("📌 Mes tâches", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(bottom = 8.dp))
                }
                items(viewModel.myTasks, key = { it.id }) { task ->
                    MyTaskRow(task = task, onComplete = { viewModel.completeTask(task.id) })
                }
            }

            item {
                Text("Tes conteneurs", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
            }
            viewModel.households.forEach { household ->
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(household.name, style = MaterialTheme.typography.labelLarge)
                        IconButton(onClick = { onNewContainer(household.id) }) {
                            Icon(Icons.Filled.Add, contentDescription = "Nouveau conteneur")
                        }
                    }
                }
                items(household.containers, key = { it.id }) { container ->
                    ContainerRow(
                        name = container.name,
                        icon = container.icon,
                        onClick = { onOpenContainer(household, container) },
                        onEdit = { onEditContainer(container.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun MyTaskRow(task: TaskItem, onComplete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onComplete) {
                    Icon(Icons.Filled.RadioButtonUnchecked, contentDescription = "Marquer comme faite")
                }
                Column(modifier = Modifier.padding(start = 4.dp)) {
                    Text(task.title, style = MaterialTheme.typography.bodyLarge)
                    val subtitle = listOfNotNull(task.containers?.name, task.dueDate).joinToString(" · ")
                    if (subtitle.isNotBlank()) {
                        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun ContainerRow(name: String, icon: String, onClick: () -> Unit, onEdit: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        onClick = onClick,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(icon, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(end = 12.dp, top = 14.dp, bottom = 14.dp))
            Text(name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, contentDescription = "Modifier le conteneur")
            }
        }
    }
}
