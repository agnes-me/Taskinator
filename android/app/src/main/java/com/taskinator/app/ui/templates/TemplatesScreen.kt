package com.taskinator.app.ui.templates

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import com.taskinator.app.AppContainer
import com.taskinator.app.data.RoomTemplate
import com.taskinator.app.data.models.Room
import com.taskinator.app.ui.IconPalette
import com.taskinator.app.ui.SimpleViewModelFactory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplatesScreen(container: AppContainer, containerId: String, onBack: () -> Unit) {
    val viewModel: TemplatesViewModel = viewModel(factory = SimpleViewModelFactory { TemplatesViewModel(container, containerId) })
    var applyTarget by remember { mutableStateOf<RoomTemplate?>(null) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("🛒 Marketplace") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
            )
        },
    ) { padding ->
        if (viewModel.isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (viewModel.errorMessage != null) {
                Text(viewModel.errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
            }
            if (viewModel.actionMessage != null) {
                Text(
                    viewModel.actionMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            val system = viewModel.templates.filter { it.isSystem }
            val containerTpl = viewModel.templates.filter { !it.isSystem && it.visibility == "container" }
            val personal = viewModel.templates.filter { !it.isSystem && it.visibility == "personal" }
            val marketplace = viewModel.templates.filter { !it.isSystem && it.visibility == "public" }

            if (viewModel.templates.isEmpty()) {
                Text(
                    "Rien à afficher pour l'instant.",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                    templateSection("Bibliothèque système", system) { applyTarget = it }
                    templateSection("Partagés dans ce conteneur", containerTpl) { applyTarget = it }
                    templateSection("Mes templates", personal) { applyTarget = it }
                    templateSection("Marketplace communautaire", marketplace) { applyTarget = it }
                }
            }
        }
    }

    applyTarget?.let { tpl ->
        ApplyTemplateDialog(
            template = tpl,
            rooms = viewModel.rooms,
            onDismiss = { applyTarget = null },
            onApplyExisting = { roomId ->
                viewModel.applyToExistingRoom(tpl.id, roomId)
                applyTarget = null
            },
            onApplyNew = { name, icon ->
                viewModel.applyToNewRoom(tpl.id, name, icon)
                applyTarget = null
            },
        )
    }
}

private fun LazyListScope.templateSection(title: String, items: List<RoomTemplate>, onApply: (RoomTemplate) -> Unit) {
    if (items.isEmpty()) return
    item {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
        )
    }
    items.forEach { tpl ->
        item(key = tpl.id) { TemplateRow(tpl, onApply = { onApply(tpl) }) }
    }
}

@Composable
private fun TemplateRow(tpl: RoomTemplate, onApply: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(tpl.icon, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(end = 12.dp))
            Text(tpl.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            TextButton(onClick = onApply) { Text("Appliquer") }
        }
    }
}

@Composable
private fun ApplyTemplateDialog(
    template: RoomTemplate,
    rooms: List<Room>,
    onDismiss: () -> Unit,
    onApplyExisting: (String) -> Unit,
    onApplyNew: (String, String) -> Unit,
) {
    var mode by remember { mutableStateOf(if (rooms.isNotEmpty()) "existing" else "new") }
    var selectedRoomId by remember { mutableStateOf(rooms.firstOrNull()?.id ?: "") }
    var newRoomName by remember { mutableStateOf(template.name) }
    var newRoomIcon by remember { mutableStateOf(template.icon) }

    Dialog(onDismissRequest = onDismiss) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    "${template.icon} ${template.name}",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(bottom = 12.dp),
                )

                if (rooms.isNotEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = mode == "existing", onClick = { mode = "existing" })
                        Text("Catégorie existante", modifier = Modifier.clickable { mode = "existing" })
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = mode == "new", onClick = { mode = "new" })
                        Text("Nouvelle catégorie", modifier = Modifier.clickable { mode = "new" })
                    }
                }

                if (mode == "existing" && rooms.isNotEmpty()) {
                    Column(modifier = Modifier.padding(top = 8.dp)) {
                        rooms.forEach { room ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth().clickable { selectedRoomId = room.id },
                            ) {
                                RadioButton(selected = selectedRoomId == room.id, onClick = { selectedRoomId = room.id })
                                Text("${room.icon} ${room.name}")
                            }
                        }
                    }
                } else {
                    OutlinedTextField(
                        value = newRoomName,
                        onValueChange = { newRoomName = it },
                        label = { Text("Nom de la nouvelle catégorie") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    Text("Icône", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    LazyVerticalGrid(columns = GridCells.Fixed(7), modifier = Modifier.fillMaxWidth().height(120.dp)) {
                        items(IconPalette.ROOM_ICONS) { candidate ->
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .padding(2.dp)
                                    .clip(CircleShape)
                                    .background(if (candidate == newRoomIcon) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)
                                    .clickable { newRoomIcon = candidate },
                                contentAlignment = Alignment.Center,
                            ) { Text(candidate) }
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Annuler") }
                    Button(
                        enabled = if (mode == "existing") selectedRoomId.isNotBlank() else newRoomName.isNotBlank(),
                        onClick = {
                            if (mode == "existing") onApplyExisting(selectedRoomId) else onApplyNew(newRoomName.trim(), newRoomIcon)
                        },
                        modifier = Modifier.padding(start = 8.dp),
                    ) { Text("Appliquer") }
                }
            }
        }
    }
}
