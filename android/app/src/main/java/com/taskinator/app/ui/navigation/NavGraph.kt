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
import com.taskinator.app.ui.container.ContainerTasksScreen
import com.taskinator.app.ui.dashboard.DashboardScreen
import com.taskinator.app.ui.login.LoginScreen
import java.net.URLDecoder
import java.net.URLEncoder

private object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val CALENDAR = "calendar"
    const val CONTAINER = "container/{containerId}/{containerName}"

    fun container(id: String, name: String): String {
        val encodedName = URLEncoder.encode(name, "UTF-8")
        return "container/$id/$encodedName"
    }
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
            )
        }
    }
}
