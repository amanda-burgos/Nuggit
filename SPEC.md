# Nuggit — SPEC (v2)

> Para la terminal / asistente de código: lee este archivo completo antes de empezar.
> Construye **solo la fase que se te pida** (ej: "haz la Fase 1"). No adelantes fases.

---

## 1. Qué es y por qué existe

**Nuggit** es una app de escritorio (Mac primero) de organización personal que se siente como tener un ayudante pequeño viviendo en tu escritorio.

Es para una persona a la que le cuesta:

- **empezar** tareas
- **decidir qué hacer primero**
- **acordarse** de las cosas
- **mantenerse concentrada**

Filosofía: **Make things easier to start, not harder to organize.**

No es una app de productividad corporativa con listas gigantes. Es un espacio personal, amigable, visual y un poquito divertido.

### Nombres (el lore)

- **Nuggit**: la app.
- **Dip**: el ayudante de IA que vive dentro de Nuggit. Es la salsita que acompaña. Tiene su propio nombre y personalidad, sin importar qué IA haya detrás (Gemini hoy, otra mañana).
- **Tenders**: los pasos chiquitos en los que Dip convierte una tarea grande.

Personalidad de Dip: casual, cálido, con humor y emojis cuando encajan, bilingüe (español/inglés). Nunca regaña ni hace sentir culpable. Calmado si el usuario está agobiado. Respuestas cortas.

---

## 2. Principios de producto

1. Reducir el agobio. Mostrar **pocas cosas**, no listas gigantes.
2. Hacer que empezar sea fácil (pasos chiquitos, de 2 a 15 minutos).
3. La IA **ayuda, no controla**: nunca cambia datos sin que el usuario confirme, y siempre se puede deshacer.
4. La app **funciona sin IA**. La IA es un extra.
5. Nada de spam de notificaciones.
6. Usabilidad antes que cantidad de features.
7. Cada feature tiene un propósito claro o no entra.

---

## 3. Reglas de desarrollo (IMPORTANTE)

Estas reglas existen para que el proyecto **se termine** y no se abandone a la mitad.

1. **Una feature a la vez, completa.** Cada fase incluye su parte visual (frontend) **y** su lógica funcionando. Nunca hacer "todo el frontend primero".
2. **Cada sesión termina con algo que funciona** y se puede abrir y usar.
3. **Primero que funcione, después que se vea bonito.** Estilo base limpio desde el inicio; los detalles de pulido van en una fase propia al final.
4. **Responsive desde el día 1.** La app debe verse bien en una laptop, en un monitor grande y con la ventana pequeña. Los widgets se reacomodan solos si no caben. Nunca scroll horizontal.
5. **Centro de control con pocas pestañas** (ver 9.0). Cada feature tiene **un solo componente** que se usa en dos tamaños: como widget y como panel completo. Nunca diseñar una pantalla desde cero si ya existe el widget.
6. **Nunca subir claves ni datos personales a GitHub.** `.gitignore` configurado desde la Fase 0.
7. Código en inglés (nombres de variables, archivos, commits). La interfaz puede estar en español/inglés.
8. Antes de cambios grandes o de instalar librerías nuevas, explicar en una frase qué y por qué.
9. Cuando una fase esté lista, decir cómo probarla en pasos simples.

---

## 4. Stack

| Parte | Tecnología |
|---|---|
| App de escritorio | **Electron** |
| Interfaz | **React + TypeScript**, con **Vite** (plantilla `electron-vite` o similar) |
| Widgets que se mueven / redimensionan | Tablero propio con posición libre en píxeles (sin librería de grid) |
| Estilos | CSS con variables (tokens de color) o Tailwind; lo que sea más simple |
| Datos | Archivos **JSON locales** en la carpeta de datos de la app (`app.getPath('userData')`), detrás de una capa de "storage" para poder cambiar a SQLite después |
| IA (primera) | **Google Gemini** con el SDK oficial (`@google/genai`) y la API key del usuario |
| Claves | Guardadas cifradas con `safeStorage` de Electron. **Nunca** en el código ni en el repo |

Seguridad de Electron: `contextIsolation: true`, `nodeIntegration: false`, todo acceso a disco e IA pasa por el **proceso main** vía `preload` + IPC. La API key nunca llega a la interfaz (renderer).

---

## 5. Arquitectura

```
src/
  main/                 # proceso main de Electron
    storage/            # leer/guardar JSON (tasks, notes, layout, settings)
    ai/
      provider.ts       # interfaz AIProvider
      gemini.ts         # adaptador de Gemini
      ollama.ts         # adaptador de Ollama (local)
      (futuro) openai.ts, claude.ts
    ipc.ts              # canales entre main y la interfaz
  preload/
    index.ts            # expone una API segura a la interfaz
  renderer/             # la interfaz (React)
    desktop/            # escritorio + layout de widgets
    widgets/
      registry.ts       # lista de widgets disponibles
      tasks/
      dip/
      tenders/
      next-action/
      brain-dump/
      notes/
      focus/
    settings/
    theme/              # colores, tipografía, tokens
    store/              # estado de la app
```

Regla: cada widget vive en su carpeta y **no importa cosas de otros widgets**. Si dos widgets necesitan los mismos datos (ej: tareas), los leen del store compartido.

---

## 6. Widget API

Cada widget se registra así. Añadir un widget nuevo = crear su carpeta + agregarlo al registry. Nada más.

```ts
export interface WidgetDefinition<Config = unknown> {
  type: string;                 // id único, ej: "tasks"
  name: string;                 // nombre visible, ej: "Tareas"
  icon: string;                 // emoji o nombre de ícono
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
  defaultConfig: Config;
  component: React.FC<WidgetProps<Config>>;
  settingsComponent?: React.FC<WidgetSettingsProps<Config>>; // opcional
  needsAI?: boolean;            // si true, muestra un aviso amable cuando no hay IA conectada
}

export interface WidgetProps<Config> {
  instanceId: string;
  config: Config;
  updateConfig: (patch: Partial<Config>) => void;
}

export interface WidgetInstance {
  id: string;          // único por instancia
  type: string;        // apunta a WidgetDefinition.type
  config: unknown;
  hidden: boolean;
}
```

El **layout** (posición y tamaño en píxeles) lo guarda el escritorio, no el widget. El tablero mide exactamente el área visible (sin scroll); los widgets no salen de los bordes. Si la ventana se achica, se dibujan movidos/achicados para caber, sin cambiar lo guardado, y vuelven a su lugar cuando la ventana crece. Se pueden encimar; el último tocado queda al frente.

---

## 7. Modelo de datos

```ts
type Priority = "low" | "medium" | "high";
type TaskStatus = "todo" | "doing" | "done";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;          // ISO date
  estimateMin?: number;      // tiempo estimado en minutos
  category?: string;         // materia o categoría
  status: TaskStatus;
  parentId?: string;         // si es un "tender" (subtarea) de otra tarea
  order: number;             // orden dentro de su padre
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  ai: {
    provider: "none" | "gemini" | "ollama" | "auto";   // "auto" = usa el que esté disponible
    model?: string;                // configurable, no hardcodear
    shareTasksWithAI: boolean;     // permiso para que la IA lea las tareas
  };
  theme: "light" | "dark" | "system";
  background?: string;
}

interface DesktopState {
  widgets: WidgetInstance[];
  positions: Record<string, { x: number; y: number; w: number; h: number }>; // px, por id de widget
  detached: Record<string, {                // widgets despegados al escritorio, por id
    bounds: { x: number; y: number; w: number; h: number }; // px de pantalla
    alwaysOnTop: boolean;                   // "Mantener encima"
  }>;
  gridVersion: number; // versión del formato, para convertir archivos viejos
}
```

Archivos: `tasks.json`, `notes.json`, `settings.json`, `desktop.json`. Guardar de forma segura (escribir a un archivo temporal y luego renombrarlo) para no corromper datos.

---

## 8. IA

### Interfaz de proveedor

```ts
interface AIMessage { role: "user" | "assistant" | "system"; content: string; }

interface AIProvider {
  id: string;
  isConfigured(): Promise<boolean>;
  chat(messages: AIMessage[], opts?: { json?: boolean }): Promise<string>;
}
```

### Contexto y privacidad

- La IA solo recibe lo que necesita para la pregunta: tareas pendientes (título, fecha, prioridad, estimado), hora actual y tiempo disponible si el usuario lo dijo.
- Solo si `shareTasksWithAI` está activado. Sin permiso, la IA no ve tareas.

### Acciones de la IA

La IA **propone**, el usuario **confirma**. Toda acción que cambie datos (crear tareas, marcar como hecha, dividir) se muestra como tarjeta con **[Guardar] [Cambiar] [Cancelar]**, y luego se puede deshacer.

### Proveedores

- **Actuales: Gemini y Ollama, los dos.**
  - **Gemini**: con API key de Google AI Studio, pegada en Settings.
  - **Ollama**: modelo local en la Mac, sin cuenta ni clave. Nuggit detecta si Ollama está corriendo.
  - **Modo "auto"** (por defecto): si uno no está disponible (sin key, sin internet, Ollama apagado), usa el otro. Si ninguno está, la app funciona sin IA y Dip lo dice amablemente.
  - En Settings se ve cuál se está usando ahora.
- **La personalidad de Dip** (sección "Nombres") se manda como **system prompt** en cada conversación, igual con cualquier proveedor. No se entrena ningún modelo.
- **Respuestas estructuradas** (Tenders, Brain Dump): con Ollama usar la opción `format` con JSON schema; con Gemini, su modo de respuesta JSON. Siempre validar el JSON.
- **Después:** "Sign in with ChatGPT" (OpenAI, para apps open-source y locales), Claude con API key.

---

## 9. Features

### 9.0 Centro de control (navegación)
La ventana principal de Nuggit tiene una **barra lateral** con pestañas. Cada pestaña es un panel a pantalla completa:
- **Inicio**: el tablero de widgets (lo que ya existe).
- **Dip**: el chat con Dip en grande, con historial.
- **Tareas**: la lista de tareas completa, con subtareas/tenders, filtros simples (hoy, pendientes, hechas).
- **Ajustes**: Settings (IA, personalidad de Dip, barra de menú, tema...).
- Más adelante, cuando existan: **Notas**, **Focus**.

Reglas:
- El panel y el widget de una misma feature usan **el mismo componente** (prop `size: "widget" | "full"`), para no duplicar código ni diseño.
- La barra lateral es colapsable (solo íconos) y responsive.
- Atajos de teclado: ⌘1 Inicio, ⌘2 Dip, ⌘3 Tareas, ⌘, Ajustes.
- Recordar la última pestaña abierta.

### 9.1 Escritorio de widgets
Una pantalla con widgets que se pueden mover, redimensionar, ocultar, mostrar, añadir y quitar. Todo se guarda. Responsive.

### 9.2 Tareas
Lista simple, con tareas y subtareas ("tenders"). Botón grande de ✅. No mostrar 40 tareas a la vez: agrupar y colapsar.

### 9.3 Tenders (feature estrella)
1. El usuario escribe una tarea grande (ej: "proyecto de ciencias").
2. La IA hace **2 o 3 preguntas cortas** (para cuándo es, qué tiene ya, si es en grupo...).
3. La IA propone una lista de pasos chiquitos, cada uno con un tiempo estimado (5–25 min).
4. El usuario puede editar, borrar o reordenar pasos.
5. **[Guardar]** crea la tarea y sus tenders.

La respuesta de la IA debe ser JSON validado (pasos: título + minutos). Si la IA falla, mostrar un mensaje amable y dejar crear los pasos a mano.

### 9.4 Dip (chat con la IA)
Panel de chat pequeño. Puede responder preguntas generales y de estudio, y usar el contexto de las tareas (con permiso).
Entiende frases como **"ya terminé X"**: propone marcarla como hecha y sugiere el siguiente tender.

### 9.5 Next Action ("¿Qué hago ahora?")
Muestra **una** acción (máximo 3) con su tiempo estimado y un botón **[Empezar]**.
Funciona **sin IA**, con reglas simples:

1. Tareas en estado `doing` primero (lo que ya empezaste).
2. Luego, por fecha límite más cercana.
3. Luego, por prioridad.
4. Si el usuario dijo cuánto tiempo tiene, solo tareas que quepan.
5. Siempre muestra el siguiente **tender**, no la tarea gigante.

Botones: **[✅ Hecho]** (pasa al siguiente), **[Saltar]**, **[Solo empieza]** (convierte el paso en una versión de 2 minutos).

Cómo quedó (Fase 5):
- Las reglas viven en `src/shared/nextAction.ts`, las mismas para el widget, la barra de menú (9.11) y el chat de Dip.
- "Tengo 15 min / 30 min / 1 h / Sin límite" para la regla 4. "Saltar" manda la acción al final de la fila. Las dos cosas duran solo el día (`next-action.json`).
- "Hecho" en el último tender termina también la tarea grande. Siempre con "Deshacer".
- "Solo empieza" marca la tarea en curso, muestra una cuenta atrás de 2 minutos y una versión chiquita del paso: la escribe Dip si hay IA y permiso para compartir tareas; si no, una frase fija.

### 9.6 Brain Dump
Caja de texto para soltar todo rápido. Con IA: lo separa en tareas y notas y lo muestra para revisar antes de guardar. Sin IA: se guarda como nota.

### 9.7 Quick Notes
Crear una nota debe ser un solo clic o un atajo de teclado.

### 9.8 Focus
Temporizador configurable (25/5, 15/5, personalizado). Pausar, cancelar y cambiar en cualquier momento. Muestra la tarea actual.

### 9.9 Lockdown
Pantalla de concentración: solo la tarea actual, el temporizador y el siguiente paso. Oculta los demás widgets. **Solo dentro de la app**: nunca bloquear el sistema. Salida siempre visible (botón + tecla Esc).

### 9.10 Voz
- Básica: dictado del sistema (Mac) para hablar, y voz del sistema (`speechSynthesis`) para que la IA conteste hablando. Botón para activar/desactivar.
- Después: conversación de voz en tiempo real.

---

### 9.11 Barra de menú (ya existe)
Nuggit vive también en la **barra de menú** de macOS (`src/main/statusTray.ts`).
- Muestra la tarea actual: "▶ Nombre de la tarea".
- En Settings se puede elegir cómo se ve: **solo ícono** o **texto** (el nombre de la tarea).
- Al hacer clic, abre un menú con: la tarea actual, **"Siguiente paso: ..."** (el próximo tender), **✅ Marcar como hecha**, **Pausar** y **Abrir Nuggit**.
- Debe seguir funcionando en todas las fases. No romperla ni quitarla.
- Cuando exista Next Action (Fase 5), la barra muestra lo mismo que ese widget, y "Marcar como hecha" pasa al siguiente tender.
- Lockdown (Fase 7) puede usarla para mostrar la tarea y el tiempo restante.

### 9.12 Personalidad de Dip (personalizable)
En Settings hay una sección **"Dip"** para cambiar cómo es Dip. Dos formas:
1. **Cajita de texto**: el usuario escribe directamente cómo quiere que sea Dip ("háblame en inglés", "sé más serio", "usa muchos emojis"...).
2. **Hablar con Dip**: un mini chat donde el usuario le dice cómo lo quiere ("quiero que seas más directo"). Dip propone el nuevo texto de personalidad y el usuario lo **aprueba** antes de guardarlo (se ve el texto final en la cajita).

Reglas:
- La personalidad base (sección "Nombres") es el valor por defecto. Botón **"Restaurar Dip original"**.
- El texto del usuario se suma al system prompt. Pero hay reglas que **no se pueden cambiar**: Dip nunca cambia datos sin confirmación, nunca regaña ni hace sentir culpable, y la app sigue funcionando sin IA.
- Se guarda en `settings.json` y aplica con Gemini y con Ollama.

### 9.13 Dailies (rutinas que se repiten)
Cosas que se repiten con un horario: "bañarme" (todos los días), "gimnasio" (solo miércoles), "tarea" (lunes a viernes), "lavar ropa" (sábados).
- Cada daily tiene: título, **repetición** (todos los días / días de la semana elegidos / cada X días), hora opcional, duración estimada.
- Cada día se generan solos como tareas de "hoy". Al marcarlos como hechos, vuelven el próximo día que toque.
- Racha opcional (cuántos días seguidos), sin culpa si se rompe.
- **Planear con Dip**: "ayúdame a armar mi rutina de la semana" → Dip hace preguntas cortas y propone los dailies → el usuario aprueba antes de guardar.
- Next Action (Fase 5) tiene en cuenta los dailies de hoy.

### 9.14 Calendario y sincronización
- Vista de **calendario** dentro de Nuggit (pestaña + widget) con tareas con fecha, dailies y eventos.
- Sincronización, de lo más fácil a lo más difícil:
  1. **Exportar a calendario (una vía)**: Nuggit genera un archivo/feed `.ics` que funciona con **Apple Calendar y Google Calendar**.
  2. **Apple Calendar en dos vías**: leer y escribir eventos usando el calendario del Mac (EventKit, con permiso del sistema).
  3. **Google Calendar en dos vías**: con la API oficial de Google Calendar y OAuth (iniciar sesión con Google). Requiere configurar un proyecto en Google Cloud.
- Igual que con la IA: se puede usar **uno, el otro, o ninguno**, y la app funciona sin calendario conectado.
- Nunca borrar ni cambiar eventos del calendario del usuario sin confirmación.

### 9.15 Dip en la barra de menú (mini chat)
Dip tiene **su propio ícono** en la barra de menú de macOS, aparte del de Nuggit (9.11).
- Al hacer clic se abre una **ventanita flotante** (popover) debajo del ícono con un **mini chat** con Dip.
- Sirve para cosas rápidas: "ponme tarea de lengua para el jueves", "ya terminé mate", "¿qué hago ahora?".
- Se cierra al hacer clic afuera, con la X o con Esc. **La conversación se guarda** y es la misma que la pestaña Dip del centro de control (un solo historial).
- Las acciones (crear, completar o cambiar tareas) usan las mismas tarjetas de confirmación de 8 ("Acciones de la IA"). Lo que se guarda aparece en **Tareas** de la app al momento.
- Atajo global opcional para abrirlo desde cualquier app (ej: ⌥ + Espacio), configurable en Ajustes.
- En Ajustes: mostrar u ocultar el ícono de Dip.
- Ícono: silueta simple de un solo color (template image de macOS, ~18 px), que se vea bien en modo claro y oscuro: `resources/icons/dipTemplate.png` (+ `@2x`). Dentro de la app, Dip usa `resources/icons/dip-icon.svg` (toma el color del texto).

## 10. Diseño visual

- Colores base: **navy blue**, **lavender**, **white**, acentos suaves.
- Esquinas redondeadas, sombras sutiles, tipografía limpia.
- Ambiente: escritorio acogedor y moderno, no corporativo.
- Modo claro y oscuro desde el inicio (tokens de color en variables).
- Cada widget tiene su ícono y un toque de color propio, pero todos del mismo sistema visual.
- Sin decoración que no sirva para nada.
- **No usar el emoji de pollo** (ni dibujos de pollo) en la interfaz, el logo ni el título.

---

## 11. Fases (MVP)

Cada fase termina con algo que se puede abrir y usar. **No pasar a la siguiente fase hasta que la anterior funcione.**

### Fase 0 — Setup
- Proyecto Electron + React + TypeScript + Vite creado y abriendo una ventana.
- Git iniciado, `.gitignore` con `node_modules`, builds, `.env` y cualquier dato local.
- README corto con cómo correr la app.
- **Listo cuando:** `npm run dev` abre la app con un "Hola 👋".

### Fase 1 — Escritorio de widgets
- Escritorio de widgets con posición libre, que mide exactamente la ventana (sin scroll) y es responsive.
- Widget Registry + 1 widget de prueba (reloj).
- Añadir, quitar, mover y redimensionar widgets. Se guarda en `desktop.json`.
- Tema base navy/lavanda con modo claro y oscuro.
- **Listo cuando:** muevo el reloj, cierro la app, la abro y sigue donde lo dejé. Al achicar la ventana, se reacomoda.

### Fase 1.5 — Despegar widgets al escritorio
- Modelo **híbrido**: el tablero dentro de la app se queda, y cada widget tiene un botón **"Despegar"** que lo saca como ventanita propia en el escritorio de Mac (sin bordes, esquinas redondeadas, mismo estilo).
- Botón para **"Regresar"** el widget al tablero de la app.
- Cada widget despegado recuerda su posición y tamaño en la pantalla, y se vuelve a abrir donde estaba al abrir Nuggit.
- No debe quedarse encima de todas las ventanas por defecto (que no estorbe a otras apps). Opción por widget: "Mantener encima".
- Si se desconecta un monitor, los widgets que quedaron fuera de pantalla vuelven a una posición visible.
- Lockdown (Fase 7) debe poder esconder los widgets despegados.
- **Listo cuando:** despego el reloj, lo pongo en mi escritorio, cierro y abro Nuggit, y sigue ahí. Le doy "Regresar" y vuelve al tablero.

### Fase 2 — Tareas
- Widget de tareas: crear, editar, borrar, marcar como hecha, subtareas.
- Guardado en `tasks.json`.
- **Listo cuando:** puedo manejar mis tareas de hoy sin IA.

### Fase 3 — Conectar Gemini + Ollama + Dip
- Settings: pegar la API key de Gemini (guardada con `safeStorage`), botón "Probar conexión", interruptor "Compartir tareas con la IA".
- Widget de Dip con chat básico.
- Guía corta dentro de Settings de cómo sacar la key gratis.
- **Listo cuando:** le pregunto algo y contesta. Sin key, la app funciona igual y el widget dice amablemente cómo conectarla.

### Fase 3.5 — Personalidad de Dip
- Sección "Dip" en Settings según 9.12: cajita de texto + mini chat para ajustar la personalidad, con aprobación antes de guardar.
- **Listo cuando:** escribo "háblame como pirata", Dip responde como pirata, y "Restaurar Dip original" lo devuelve a la normalidad.

### Fase 3.7 — Centro de control
- Barra lateral con pestañas Inicio, Dip, Tareas y Ajustes según 9.0.
- Dip y Tareas a pantalla completa, reutilizando los componentes de sus widgets.
- Mover Settings a la pestaña Ajustes.
- **Listo cuando:** puedo chatear con Dip en grande y manejar mis tareas en su pestaña sin tocar el tablero, y ⌘1/⌘2/⌘3 cambian de pestaña.

### Fase 4 — Tenders
- Flujo completo de la sección 9.3.
- **Listo cuando:** le doy "proyecto de ciencias", me hace preguntas y me guarda los tenders después de confirmar.

### Fase 4.5 — Dip en la barra de menú
- Ícono de Dip + mini chat flotante según 9.15, compartiendo historial y acciones con el Dip de la app.
- **Listo cuando:** desde cualquier app, abro el mini chat, escribo "anota tarea de lengua para el jueves", confirmo, cierro la ventanita y la tarea ya está en Tareas.

### Fase 5 — Next Action + "ya terminé"
- Conectar la barra de menú (9.11) con Next Action: misma tarea y mismo siguiente paso.
- Widget Next Action con las reglas de 9.5.
- En el chat, "ya terminé X" propone marcarla como hecha y sugiere la siguiente.
- **Listo cuando:** abro la app y sé qué hacer en menos de 5 segundos.

### Fase 5.5 — Dailies
- Dailies según 9.13: crear, repetir por días, marcarlos hechos, y planearlos con Dip (con aprobación).
- **Listo cuando:** creo "gimnasio" solo los miércoles y "bañarme" todos los días, y el miércoles aparecen los dos en hoy y el jueves solo "bañarme".

### Fase 6 — Brain Dump + Quick Notes

### Fase 7 — Focus + Lockdown

### Fase 8 — Voz básica

### Fase 8.5 — Calendario
- Vista de calendario (pestaña + widget) según 9.14.
- Paso 1: exportar a `.ics` (Apple y Google). Paso 2: Apple Calendar en dos vías. Paso 3 (si da tiempo): Google Calendar en dos vías.
- **Listo cuando:** veo mis tareas y dailies en el calendario de Nuggit y también aparecen en mi calendario del Mac.

### Fase 9 — Pulido visual + personalización
- Animaciones suaves y detalles de diseño.
- **Personalización** en Ajustes → "Apariencia": elegir tema (claro/oscuro/sistema), **color de acento**, **fondo** del tablero (colores o imagen propia), y estilo de los widgets (sombra, transparencia, esquinas).
- Ícono y logo definitivos de Nuggit.

### Fase 10 — Ayuda, tutorial y FAQ
- **Bienvenida (primera vez que se abre):** un tour corto de 4–5 pasos con burbujitas que señalan cada parte: el tablero, cómo despegar widgets, la barra de menú, Dip y Ajustes. Botón "Saltar" siempre visible. Se puede repetir desde Ayuda.
- **Pestaña "Ayuda"** en el centro de control con:
  - **Cómo se usa** cada feature (tareas, tenders, Dip, Focus, Lockdown, widgets, barra de menú), con explicaciones cortas.
  - **Dónde personalizar** cada cosa (colores, fondo, tema, personalidad de Dip, barra de menú), con botón que lleva directo a ese ajuste.
  - **FAQ**: preguntas frecuentes (¿Funciona sin internet? ¿Dónde se guardan mis datos? ¿Cómo conecto Gemini u Ollama? ¿Cómo salgo de Lockdown? ¿Cómo regreso un widget al tablero?...).
  - **Atajos de teclado**.
- Los textos de ayuda viven en un archivo (ej: `help.json` o Markdown) para editarlos fácil.
- Dip puede responder "¿cómo hago X en Nuggit?" usando esos mismos textos de ayuda.
- **Listo cuando:** alguien que nunca vio Nuggit puede abrirla, seguir el tour y saber usarla sin preguntarme nada.

### Después del MVP (ideas)
QOTD (banco de preguntas incluido + generadas por código + IA para conversar), School, Recordatorios (con la app en la barra de menú), exportar/backup, más proveedores de IA, voz en tiempo real, versión para celular.

---

## 12. Cómo trabajar con este spec

En cada sesión con la terminal:

```
Lee SPEC.md. Haz solo la Fase N. Al terminar, dime cómo probarla.
```

Si algo del spec no tiene sentido o es muy difícil, la terminal debe **decirlo y proponer una alternativa** antes de construir.
