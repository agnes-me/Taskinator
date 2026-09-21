package com.taskinator.app.ui.rooms

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import com.taskinator.app.data.models.Room
import com.taskinator.app.ui.IconPalette
import com.taskinator.app.ui.SimpleViewModelFactory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomsManageScreen(container: AppContainer, containerId: String, onBack: () -> Unit, onOpenTemplates: () -> Unit) {
    val viewModel: RoomsManageViewModel = viewModel(factory = SimpleViewModelFactory { RoomsManageViewModel(container, containerId) })
    var editingRoom by remember { mutableStateOf<Room?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Room?>(null) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Catégories") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                actions = {
                    IconButton(onClick = onOpenTemplates) {
                        Icon(Icons.Filled.Storefront, contentDescription = "Marketplace de templates")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateDialog = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Ajouter une catégorie")
            }
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
                Text(
                    viewModel.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp),
                )
            }
            if (viewModel.rooms.isEmpty()) {
                Text(
                    "Aucune catégorie pour l'instant.",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                    items(viewModel.rooms, key = { it.id }) { room ->
                        RoomRow(
                            room = room,
                            onEdit = { editingRoom = room },
                            onDelete = { deleteTarget = room },
                        )
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        RoomFormDialog(
            initial = null,
            onDismiss = { showCreateDialog = false },
            onConfirm = { name, icon, freshness -> viewModel.createRoom(name, icon, freshness) { showCreateDialog = false } },
        )
    }
    editingRoom?.let { room ->
        RoomFormDialog(
            initial = room,
            onDismiss = { editingRoom = null },
            onConfirm = { name, icon, freshness -> viewModel.updateRoom(room.id, name, icon, freshness) { editingRoom = null } },
        )
    }
    deleteTarget?.let { room ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Supprimer « ${room.name} » ?") },
            text = { Text("Les tâches de cette catégorie ne seront pas supprimées, juste détachées.") },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteRoom(room.id); deleteTarget = null }) { Text("Supprimer") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Annuler") }
            },
        )
    }
}

@Composable
private fun RoomRow(room: Room, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(room.icon, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(end = 12.dp))
            Text(room.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            IconButton(onClick = onEdit) { Icon(Icons.Filled.Edit, contentDescription = "Modifier") }
            IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = "Supprimer") }
        }
    }
}

@Composable
private fun RoomFormDialog(initial: Room?, onDismiss: () -> Unit, onConfirm: (String, String, Int) -> Unit) {
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var icon by remember { mutableStateOf(initial?.icon ?: IconPalette.ROOM_ICONS.first()) }
    var freshnessText by remember { mutableStateOf((initial?.freshnessDays ?: 7).toString()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    if (initial == null) "Nouvelle catégorie" else "Modifier la catégorie",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(bottom = 16.dp),
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = freshnessText,
                    onValueChange = { freshnessText = it.filter(Char::isDigit) },
                    label = { Text("Fraîcheur par défaut (jours)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                )

                Text("Icône", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
                LazyVerticalGrid(
                    columns = GridCells.Fixed(7),
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                ) {
                    items(IconPalette.ROOM_ICONS) { candidate ->
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .padding(2.dp)
                                .clip(CircleShape)
                                .background(if (candidate == icon) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)
                                .clickable { icon = candidate },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(candidate)
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Annuler") }
                    Button(
                        onClick = { onConfirm(name, icon, freshnessText.toIntOrNull()?.coerceAtLeast(1) ?: 7) },
                        enabled = name.isNotBlank(),
                        modifier = Modifier.padding(start = 8.dp),
                    ) { Text("Enregistrer") }
                }
            }
        }
    }
}
