package com.taskinator.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BrandTeal = Color(0xFF0D9488)
val BrandTealDark = Color(0xFF0F766E)
val BrandIndigo = Color(0xFF6366F1)
val FreshLow = Color(0xFFEF4444)
val FreshMid = Color(0xFFF59E0B)
val FreshHigh = Color(0xFF22C55E)

private val LightColors = lightColorScheme(
    primary = BrandTeal,
    onPrimary = Color.White,
    secondary = BrandIndigo,
    surface = Color(0xFFF8FAFC),
    background = Color(0xFFF8FAFC),
)

private val DarkColors = darkColorScheme(
    primary = BrandTeal,
    onPrimary = Color.White,
    secondary = BrandIndigo,
    surface = Color(0xFF0F172A),
    background = Color(0xFF0F172A),
)

@Composable
fun TaskinatorTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
