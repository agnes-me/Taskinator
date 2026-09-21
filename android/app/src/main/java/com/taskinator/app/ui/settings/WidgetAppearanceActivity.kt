package com.taskinator.app.ui.settings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.taskinator.app.data.WidgetAppearanceStore
import com.taskinator.app.ui.theme.TaskinatorTheme
import com.taskinator.app.widget.TaskinatorWidget
import com.taskinator.app.widget.WidgetStyle
import com.taskinator.app.widget.calendar.CalendarWidget
import com.taskinator.app.widget.tasklist.TaskListWidget
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.launch

/** Réglage de la transparence du fond sombre des trois widgets, avec aperçu en direct. */
class WidgetAppearanceActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            TaskinatorTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppearanceScreen(
                        onOpacityChanged = { value ->
                            lifecycleScope.launch {
                                WidgetAppearanceStore.setOpacity(this@WidgetAppearanceActivity, value)
                                TaskinatorWidget().updateAll(this@WidgetAppearanceActivity)
                                TaskListWidget().updateAll(this@WidgetAppearanceActivity)
                                CalendarWidget().updateAll(this@WidgetAppearanceActivity)
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun AppearanceScreen(onOpacityChanged: (Float) -> Unit) {
    var opacity by remember { mutableFloatStateOf(WidgetAppearanceStore.DEFAULT_OPACITY) }
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) {
        opacity = WidgetAppearanceStore.currentOpacity(context)
    }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
            Text("🎨 Apparence des widgets", style = MaterialTheme.typography.titleLarge)
            Text(
                "Les trois widgets d'écran d'accueil sont sombres et transparents, pour se fondre dans ton fond d'écran. Règle ici le degré de transparence — l'aperçu ci-dessous se met à jour en direct, et le changement s'applique aux widgets déjà posés en quelques secondes.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 20.dp),
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(WidgetStyle.background(opacity)),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("✅ Mes tâches", color = WidgetStyle.accent)
                    Text(
                        "Sortir les poubelles · demain",
                        color = WidgetStyle.titleText,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            Text(
                text = "Transparent  ·  Opaque",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 20.dp),
            )
            Slider(
                value = opacity,
                onValueChange = { opacity = it },
                onValueChangeFinished = { onOpacityChanged(opacity) },
                valueRange = 0.1f..1f,
            )
            Text(
                text = "${(opacity * 100).toInt()}% opaque",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
