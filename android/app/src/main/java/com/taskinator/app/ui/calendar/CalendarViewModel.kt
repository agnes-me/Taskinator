package com.taskinator.app.ui.calendar

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.data.google.GoogleCalendarStore
import com.taskinator.app.data.google.MergedGoogleEvent
import com.taskinator.app.data.models.TaskItem
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class CalendarMode { MONTH, WEEK }

class CalendarViewModel(private val app: TaskinatorApplication) : ViewModel() {
    private val taskRepository = app.container.taskRepository
    private val authRepository = app.container.authRepository
    private val googleCalendarRepository = app.container.googleCalendarRepository
    private val googleAuthManager = app.container.googleAuthManager
    private val googleStore = GoogleCalendarStore(app)

    var mode by mutableStateOf(CalendarMode.MONTH)
        private set
    var anchorDate by mutableStateOf(LocalDate.now())
        private set
    var selectedDate by mutableStateOf(LocalDate.now())
        private set
    var tasksByDate by mutableStateOf<Map<LocalDate, List<TaskItem>>>(emptyMap())
        private set
    var eventsByDate by mutableStateOf<Map<LocalDate, List<MergedGoogleEvent>>>(emptyMap())
        private set
    var isLoading by mutableStateOf(true)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    init {
        refresh()
    }

    fun changeMode(newMode: CalendarMode) {
        if (newMode == mode) return
        mode = newMode
        refresh()
    }

    fun selectDate(date: LocalDate) {
        selectedDate = date
    }

    fun goToPrevious() {
        anchorDate = if (mode == CalendarMode.MONTH) anchorDate.minusMonths(1) else anchorDate.minusWeeks(1)
        refresh()
    }

    fun goToNext() {
        anchorDate = if (mode == CalendarMode.MONTH) anchorDate.plusMonths(1) else anchorDate.plusWeeks(1)
        refresh()
    }

    fun goToToday() {
        anchorDate = LocalDate.now()
        selectedDate = LocalDate.now()
        refresh()
    }

    fun completeTask(taskId: String) {
        viewModelScope.launch {
            val userId = authRepository.currentUserId() ?: return@launch
            runCatching { taskRepository.completeTask(taskId, userId) }
            app.container.scheduleWidgetRefresh()
            refresh()
        }
    }

    fun visibleRange(): Pair<LocalDate, LocalDate> = if (mode == CalendarMode.MONTH) {
        val ym = YearMonth.from(anchorDate)
        ym.atDay(1) to ym.atEndOfMonth()
    } else {
        val monday = anchorDate.with(DayOfWeek.MONDAY)
        monday to monday.plusDays(6)
    }

    fun refresh() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val (rangeStart, rangeEnd) = visibleRange()
                val fmt = DateTimeFormatter.ISO_LOCAL_DATE
                val tasks = taskRepository.getTasksInRange(rangeStart.format(fmt), rangeEnd.format(fmt))
                tasksByDate = tasks
                    .mapNotNull { task -> task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }?.let { it to task } }
                    .groupBy({ it.first }, { it.second })

                eventsByDate = if (googleStore.isConnected()) {
                    val token = runCatching { googleAuthManager.getAccessTokenSilently() }.getOrNull()
                    if (token != null) {
                        val zone = ZoneId.systemDefault()
                        val timeMin = rangeStart.atStartOfDay(zone).toInstant()
                        val timeMax = rangeEnd.plusDays(1).atStartOfDay(zone).toInstant().minusSeconds(1)
                        val events = runCatching { googleCalendarRepository.getEventsInRange(token, timeMin, timeMax) }.getOrDefault(emptyList())
                        events.mapNotNull { event -> runCatching { LocalDate.parse(event.startDate) }.getOrNull()?.let { it to event } }
                            .groupBy({ it.first }, { it.second })
                    } else {
                        emptyMap()
                    }
                } else {
                    emptyMap()
                }
            } catch (e: Exception) {
                errorMessage = "Impossible de charger le calendrier — ${e::class.simpleName}: ${e.message ?: "erreur inconnue"}"
            } finally {
                isLoading = false
            }
        }
    }
}
