package com.taskinator.app.ui.container

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.models.TaskItem
import com.taskinator.app.ui.SimpleViewModelFactory
import com.taskinator.app.ui.theme.FreshHigh
import com.taskinator.app.ui.theme.FreshLow
import com.taskinator.app.ui.theme.FreshMid

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContainerTasksScreen(app: TaskinatorApplication, containerId: String, containerName: String, onBack: () -> Unit) {
    val viewModel: ContainerTasksViewModel = viewModel(
        factory = SimpleViewModelFactory { ContainerTasksViewModel(containerId, app.container) },
    )

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(containerName) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        },
    ) { padding ->
        if (viewModel.isLoading && viewModel.tasks.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        if (viewModel.tasks.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Aucune tâche ici pour l'instant.")
            }
            return@Scaffold
        }

        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
            if (viewModel.errorMessage != null) {
                item {
                    Text(viewModel.errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 8.dp))
                }
            }
            items(viewModel.tasks, key = { it.id }) { task ->
                TaskRowItem(task = task, onToggle = { viewModel.completeTask(task.id) })
            }
        }
    }
}

private fun priorityColor(priority: String): Color = when (priority) {
    "high" -> FreshLow
    "low" -> FreshHigh
    else -> FreshMid
}

@Composable
private fun TaskRowItem(task: TaskItem, onToggle: () -> Unit) {
    val done = task.status == "done"
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = done, onCheckedChange = { onToggle() })
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(priorityColor(task.priority)),
            )
            Column(modifier = Modifier.padding(start = 10.dp)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    textDecoration = if (done) TextDecoration.LineThrough else null,
                )
                val subtitle = listOfNotNull(task.rooms?.name, task.dueDate).joinToString(" · ")
                if (subtitle.isNotBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
