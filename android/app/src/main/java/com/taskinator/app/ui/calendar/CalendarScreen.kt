package com.taskinator.app.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.google.MergedGoogleEvent
import com.taskinator.app.data.models.TaskItem
import com.taskinator.app.ui.SimpleViewModelFactory
import com.taskinator.app.ui.theme.BrandIndigo
import com.taskinator.app.ui.theme.BrandTeal
import com.taskinator.app.ui.theme.FreshHigh
import com.taskinator.app.ui.theme.FreshLow
import com.taskinator.app.ui.theme.FreshMid
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(app: TaskinatorApplication, onBack: () -> Unit) {
    val viewModel: CalendarViewModel = viewModel(factory = SimpleViewModelFactory { CalendarViewModel(app) })

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("📅 Calendrier") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::goToToday) {
                        Icon(Icons.Filled.Today, contentDescription = "Aujourd'hui")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = viewModel.mode == CalendarMode.MONTH,
                    onClick = { viewModel.setMode(CalendarMode.MONTH) },
                    label = { Text("Mois") },
                )
                FilterChip(
                    selected = viewModel.mode == CalendarMode.WEEK,
                    onClick = { viewModel.setMode(CalendarMode.WEEK) },
                    label = { Text("Semaine") },
                )
            }

            NavigationHeader(
                mode = viewModel.mode,
                anchorDate = viewModel.anchorDate,
                onPrevious = viewModel::goToPrevious,
                onNext = viewModel::goToNext,
            )

            if (viewModel.errorMessage != null) {
                Text(
                    viewModel.errorMessage.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (viewModel.isLoading) {
                Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }

            when (viewModel.mode) {
                CalendarMode.MONTH -> MonthGrid(
                    anchorDate = viewModel.anchorDate,
                    selectedDate = viewModel.selectedDate,
                    tasksByDate = viewModel.tasksByDate,
                    eventsByDate = viewModel.eventsByDate,
                    onSelectDate = viewModel::selectDate,
                )
                CalendarMode.WEEK -> {}
            }

            LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                when (viewModel.mode) {
                    CalendarMode.MONTH -> {
                        item {
                            Text(
                                formatDayHeader(viewModel.selectedDate),
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
                            )
                        }
                        agendaItems(
                            tasks = viewModel.tasksByDate[viewModel.selectedDate].orEmpty(),
                            events = viewModel.eventsByDate[viewModel.selectedDate].orEmpty(),
                            onComplete = viewModel::completeTask,
                        )
                    }
                    CalendarMode.WEEK -> {
                        val (start, _) = viewModel.visibleRange()
                        for (offset in 0..6) {
                            val date = start.plusDays(offset.toLong())
                            item {
                                Text(
                                    formatDayHeader(date),
                                    style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
                                )
                            }
                            val dayTasks = viewModel.tasksByDate[date].orEmpty()
                            val dayEvents = viewModel.eventsByDate[date].orEmpty()
                            if (dayTasks.isEmpty() && dayEvents.isEmpty()) {
                                item {
                                    Text(
                                        "Rien de prévu.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            } else {
                                agendaItems(tasks = dayTasks, events = dayEvents, onComplete = viewModel::completeTask)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.agendaItems(
    tasks: List<TaskItem>,
    events: List<MergedGoogleEvent>,
    onComplete: (String) -> Unit,
) {
    items(tasks, key = { "task-${it.id}" }) { task -> TaskAgendaRow(task = task, onToggle = { onComplete(task.id) }) }
    items(events, key = { "event-${it.id}" }) { event -> GoogleEventAgendaRow(event = event) }
    if (tasks.isEmpty() && events.isEmpty()) {
        item {
            Text(
                "Rien de prévu.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun NavigationHeader(mode: CalendarMode, anchorDate: LocalDate, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrevious) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Précédent") }
        Text(
            text = if (mode == CalendarMode.MONTH) formatMonthLabel(anchorDate) else formatWeekLabel(anchorDate),
            style = MaterialTheme.typography.titleMedium,
        )
        IconButton(onClick = onNext) { Icon(Icons.Filled.ChevronRight, contentDescription = "Suivant") }
    }
}

@Composable
private fun MonthGrid(
    anchorDate: LocalDate,
    selectedDate: LocalDate,
    tasksByDate: Map<LocalDate, List<TaskItem>>,
    eventsByDate: Map<LocalDate, List<MergedGoogleEvent>>,
    onSelectDate: (LocalDate) -> Unit,
) {
    val firstOfMonth = anchorDate.withDayOfMonth(1)
    val daysInMonth = anchorDate.lengthOfMonth()
    val leadingBlanks = (firstOfMonth.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
    val totalCells = leadingBlanks + daysInMonth
    val rows = (totalCells + 6) / 7

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            for (dow in DayOfWeek.entries) {
                Text(
                    text = dow.getDisplayName(TextStyle.NARROW, Locale.FRENCH).uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
        for (row in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (col in 0..6) {
                    val cellIndex = row * 7 + col
                    val dayNumber = cellIndex - leadingBlanks + 1
                    if (dayNumber in 1..daysInMonth) {
                        val date = firstOfMonth.withDayOfMonth(dayNumber)
                        DayCell(
                            date = date,
                            isSelected = date == selectedDate,
                            isToday = date == LocalDate.now(),
                            hasTasks = tasksByDate[date]?.isNotEmpty() == true,
                            hasEvents = eventsByDate[date]?.isNotEmpty() == true,
                            onClick = { onSelectDate(date) },
                            modifier = Modifier.weight(1f),
                        )
                    } else {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate,
    isSelected: Boolean,
    isToday: Boolean,
    hasTasks: Boolean,
    hasEvents: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .padding(2.dp)
            .clip(CircleShape)
            .background(if (isSelected) BrandTeal else if (isToday) BrandTeal.copy(alpha = 0.15f) else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = date.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyMedium,
                color = if (isSelected) androidx.compose.ui.graphics.Color.White else MaterialTheme.colorScheme.onSurface,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                if (hasTasks) Dot(if (isSelected) androidx.compose.ui.graphics.Color.White else BrandTeal)
                if (hasEvents) Dot(if (isSelected) androidx.compose.ui.graphics.Color.White else BrandIndigo)
            }
        }
    }
}

@Composable
private fun Dot(color: androidx.compose.ui.graphics.Color) {
    Box(modifier = Modifier.size(4.dp).clip(CircleShape).background(color))
}

@Composable
private fun TaskAgendaRow(task: TaskItem, onToggle: () -> Unit) {
    val done = task.status == "done"
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = done, onCheckedChange = { onToggle() })
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(priorityColor(task.priority)))
            Column(modifier = Modifier.padding(start = 10.dp)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    textDecoration = if (done) TextDecoration.LineThrough else null,
                )
                val subtitle = listOfNotNull(task.containers?.name, task.rooms?.name).joinToString(" · ")
                if (subtitle.isNotBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun GoogleEventAgendaRow(event: MergedGoogleEvent) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🗓️", modifier = Modifier.padding(end = 10.dp))
            Column {
                Text(event.title, style = MaterialTheme.typography.bodyLarge)
                val subtitle = listOfNotNull(event.startAt, event.calendarName).joinToString(" · ")
                if (subtitle.isNotBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

private fun priorityColor(priority: String) = when (priority) {
    "high" -> FreshLow
    "low" -> FreshHigh
    else -> FreshMid
}

private fun formatMonthLabel(date: LocalDate): String {
    val name = date.month.getDisplayName(TextStyle.FULL, Locale.FRENCH)
    return "${name.replaceFirstChar { it.uppercase() }} ${date.year}"
}

private fun formatWeekLabel(anchorDate: LocalDate): String {
    val monday = anchorDate.with(DayOfWeek.MONDAY)
    val sunday = monday.plusDays(6)
    val monthName = sunday.month.getDisplayName(TextStyle.SHORT, Locale.FRENCH)
    return "${monday.dayOfMonth} – ${sunday.dayOfMonth} ${monthName.replaceFirstChar { it.uppercase() }}"
}

private fun formatDayHeader(date: LocalDate): String {
    val dowName = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.FRENCH).replaceFirstChar { it.uppercase() }
    val monthName = date.month.getDisplayName(TextStyle.SHORT, Locale.FRENCH)
    return "$dowName ${date.dayOfMonth} $monthName"
}
