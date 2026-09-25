package com.taskinator.app.widget

import androidx.compose.ui.graphics.Color

/** Palette sombre/translucide partagée par les trois widgets — l'opacité du fond est réglable dans l'appli. */
object WidgetStyle {
    private val BACKGROUND_BASE = Color(0xFF0F172A)

    fun background(opacity: Float): Color = BACKGROUND_BASE.copy(alpha = opacity.coerceIn(0f, 1f))

    val accent = Color(0xFF5EEAD4)
    val titleText = Color(0xFFF8FAFC)
    val metaText = Color(0xFFCBD5E1)
    val emptyText = Color(0xFF94A3B8)
    val tapTargetBackground = Color(0x33FFFFFF)

    /** Couleur d'un agenda (hex stocké dans ical_subscriptions.color) ; repli sur l'accent si absente/invalide. */
    fun calendarColor(hex: String?): Color = hex
        ?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() }
        ?: accent
}
