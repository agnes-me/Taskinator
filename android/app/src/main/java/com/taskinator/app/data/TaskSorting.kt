package com.taskinator.app.data

import com.taskinator.app.data.models.TaskItem

private val PRIORITY_RANK = mapOf("high" to 0, "medium" to 1, "low" to 2)

/** Priorité d'abord (haute en tête), puis échéance la plus proche — même logique que le tri web. */
val taskUrgencyComparator: Comparator<TaskItem> = compareBy<TaskItem> { PRIORITY_RANK[it.priority] ?: 1 }
    .thenBy { it.dueDate ?: "9999-99-99" }
