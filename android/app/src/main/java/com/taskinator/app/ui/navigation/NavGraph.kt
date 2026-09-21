package com.taskinator.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.taskinator.app.TaskinatorApplication
import com.taskinator.app.ui.calendar.CalendarScreen
import com.taskinator.app.ui.container.ContainerFormScreen
import com.taskinator.app.ui.container.ContainerTasksScreen
import com.taskinator.app.ui.dashboard.DashboardScreen
import com.taskinator.app.ui.login.LoginScreen
import com.taskinator.app.ui.rooms.RoomsManageScreen
import com.taskinator.app.ui.task.TaskFormScreen
import java.net.URLDecoder
import java.net.URLEncoder

private object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val CALENDAR = "calendar"
    // Chaque route a un premier segment littéral distinct ("container-tasks", "task-form", ...)
    // pour qu'aucune ne puisse être confondue avec {containerName} en position joker — deux
    // routes commençant toutes deux par "container/{containerId}/..." s'ambiguïseraient sinon.
    const val CONTAINER = "container-tasks/{containerId}/{containerName}"
    const val TASK_FORM = "task-form/{containerId}?taskId={taskId}"
    const val ROOMS_MANAGE = "rooms-manage/{containerId}"
    const val CONTAINER_FORM = "container-form?householdId={householdId}&containerId={containerId}"

    fun container(id: String, name: String): String {
        val encodedName = URLEncoder.encode(name, "UTF-8")
        return "container-tasks/$id/$encodedName"
    }

    fun taskForm(containerId: String, taskId: String? = null) =
        "task-form/$containerId" + (taskId?.let { "?taskId=$it" } ?: "")

    fun roomsManage(containerId: String) = "rooms-manage/$containerId"

    fun containerFormCreate(householdId: String) = "container-form?householdId=$householdId"

    fun containerFormEdit(containerId: String) = "container-form?containerId=$containerId"
}

@Composable
fun TaskinatorNavGraph(app: TaskinatorApplication) {
    val navController: NavHostController = rememberNavController()
    // initial = null car la première lecture DataStore est asynchrone ; le LaunchedEffect
    // ci-dessous redirige dès que la vraie valeur arrive, plutôt que de figer le point de
    // départ du NavHost (qui n'est lu qu'une seule fois, à sa toute première composition).
    val session by app.container.tokenStore.sessionFlow.collectAsState(initial = null)

    LaunchedEffect(session) {
        val loggedIn = session != null
        val current = navController.currentDestination?.route
        if (loggedIn && current == Routes.LOGIN) {
            navController.navigate(Routes.DASHBOARD) {
                popUpTo(Routes.LOGIN) { inclusive = true }
            }
        } else if (!loggedIn && current != null && current != Routes.LOGIN) {
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(navController = navController, startDestination = Routes.LOGIN) {
        composable(Routes.LOGIN) {
            LoginScreen(
                authRepository = app.container.authRepository,
                onSignedIn = {
                    app.container.scheduleWidgetRefresh()
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.DASHBOARD) {
            DashboardScreen(
                app = app,
                onOpenContainer = { _, container -> navController.navigate(Routes.container(container.id, container.name)) },
                onOpenCalendar = { navController.navigate(Routes.CALENDAR) },
                onNewContainer = { householdId -> navController.navigate(Routes.containerFormCreate(householdId)) },
                onEditContainer = { containerId -> navController.navigate(Routes.containerFormEdit(containerId)) },
                onSignedOut = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.DASHBOARD) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.CALENDAR) {
            CalendarScreen(app = app, onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.CONTAINER,
            arguments = listOf(
                navArgument("containerId") { type = NavType.StringType },
                navArgument("containerName") { type = NavType.StringType },
            ),
        ) { backStackEntry ->
            val containerId = backStackEntry.arguments?.getString("containerId").orEmpty()
            val encodedName = backStackEntry.arguments?.getString("containerName").orEmpty()
            val containerName = URLDecoder.decode(encodedName, "UTF-8")
            ContainerTasksScreen(
                app = app,
                containerId = containerId,
                containerName = containerName,
                onBack = { navController.popBackStack() },
                onNewTask = { navController.navigate(Routes.taskForm(containerId)) },
                onEditTask = { taskId -> navController.navigate(Routes.taskForm(containerId, taskId)) },
                onManageRooms = { navController.navigate(Routes.roomsManage(containerId)) },
            )
        }
        composable(
            route = Routes.TASK_FORM,
            arguments = listOf(
                navArgument("containerId") { type = NavType.StringType },
                navArgument("taskId") { type = NavType.StringType; nullable = true; defaultValue = null },
            ),
        ) { backStackEntry ->
            val containerId = backStackEntry.arguments?.getString("containerId").orEmpty()
            val taskId = backStackEntry.arguments?.getString("taskId")
            TaskFormScreen(
                container = app.container,
                containerId = containerId,
                taskId = taskId,
                onSaved = { navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }
        composable(
            route = Routes.ROOMS_MANAGE,
            arguments = listOf(navArgument("containerId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val containerId = backStackEntry.arguments?.getString("containerId").orEmpty()
            RoomsManageScreen(container = app.container, containerId = containerId, onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.CONTAINER_FORM,
            arguments = listOf(
                navArgument("householdId") { type = NavType.StringType; nullable = true; defaultValue = null },
                navArgument("containerId") { type = NavType.StringType; nullable = true; defaultValue = null },
            ),
        ) { backStackEntry ->
            val householdId = backStackEntry.arguments?.getString("householdId")
            val containerId = backStackEntry.arguments?.getString("containerId")
            ContainerFormScreen(
                container = app.container,
                householdId = householdId,
                containerId = containerId,
                onSaved = { navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }
    }
}
