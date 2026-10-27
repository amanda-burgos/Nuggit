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
- **Tenderizer**: la herramienta que convierte una tarea grande en tenders (9.3).

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
10. **Update log:** en cada commit de una fase o arreglo importante, agregar una entrada en `CHANGELOG.md` (fecha, versión, y en lenguaje simple qué hay de nuevo, qué se arregló y qué cambió). Subir la versión en `package.json` (0.x.0 por fase, 0.x.y por arreglos).

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
      openaiCompatible.ts  # adaptador para servidores con API de OpenAI
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
    provider: "none" | "gemini" | "ollama" | "openaiCompatible" | "auto";   // "auto" = usa el que esté disponible
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

- **Actuales: Gemini, Ollama y un servidor propio compatible con OpenAI.**
  - **Servidor propio (OpenAI-compatible)**: cualquier servidor que hable la API de OpenAI (`/v1/chat/completions`). Se configura en Ajustes con: nombre, **base URL**, **modelo**, API key opcional, y una **lista de servidores de respaldo** (si el primero no responde o tarda mucho, prueba el siguiente). Acepta texto e imágenes si el modelo lo soporta.
    - Las URLs y nombres de estos servidores son **datos del usuario**: se guardan en `settings.json`, **nunca en el código ni en el repo**.
    - Si el servidor necesita una VPN (ej. Tailscale) y no responde, mostrar un mensaje claro: "No llego al servidor. ¿Está Tailscale prendido?".
    - Timeout razonable y un solo intento por servidor antes de pasar al siguiente (estos servidores atienden una petición a la vez).
    - De la respuesta se muestra **solo `content`**, nunca `reasoning_content` (ni bloques `<think>`).
  - **Gemini**: con API key de Google AI Studio, pegada en Settings.
  - **Ollama**: modelo local en la Mac, sin cuenta ni clave. Nuggit detecta si Ollama está corriendo.
  - **Modo "auto"** (por defecto): usa los proveedores en el **orden que el usuario elija** en Ajustes; si uno no está disponible (sin key, sin internet, Ollama apagado, servidor caído), pasa al siguiente. Si ninguno está, la app funciona sin IA y Dip lo dice amablemente.
  - En Settings se ve cuál se está usando ahora.
- **La personalidad de Dip** (sección "Nombres") se manda como **system prompt** en cada conversación, igual con cualquier proveedor. No se entrena ningún modelo.
- **Respuestas estructuradas** (Tenders, Brain Dump): con Ollama usar la opción `format` con JSON schema; con Gemini, su modo de respuesta JSON. Siempre validar el JSON.
- **Después:** "Sign in with ChatGPT" (OpenAI, para apps open-source y locales), Claude con API key.

---

### 8.1 Agentes, configuración y autocorrección (requisitos del bootcamp)

**Agentes.** Nuggit tiene varios agentes, todos sobre la misma capa `AIProvider`:
- `dip` (chat), `tenderizer` (dividir tareas), `dailies` (planear rutinas), `actions` (decidir/ejecutar acciones sobre tareas), y después `brainDump`.
- Cada agente se define en `src/main/ai/agents/` con: nombre, instrucciones (system prompt), schema de salida (si devuelve JSON) y qué herramientas/acciones puede usar.

**Proveedor y modelo por configuración, sin tocar código.** Orden de prioridad:
1. **Variables de entorno / `.env`** (para desarrollo y para el profe): ej.
   - `NUGGIT_AI_PROVIDER=gemini|ollama|openaiCompatible|auto`
   - `NUGGIT_AI_MODEL=...`
   - `NUGGIT_AI_ORDER=openaiCompatible,ollama,gemini` (orden del modo auto)
   - `NUGGIT_OLLAMA_URL=http://127.0.0.1:11434`
   - `NUGGIT_OPENAI_BASE_URLS=url1,url2` · `NUGGIT_OPENAI_MODEL=...` · `NUGGIT_OPENAI_API_KEY=...`
   - `GEMINI_API_KEY=...`
   - Por agente (opcional): `NUGGIT_AGENT_TENDERIZER_PROVIDER`, `NUGGIT_AGENT_TENDERIZER_MODEL`, etc.
2. **Ajustes de la app** (`settings.json`).
3. **Valores por defecto** en un archivo de config versionado (`config/ai.defaults.json`), no hardcodeados en el código.
- Se incluye **`.env.example`** con todas las variables documentadas (sin valores secretos). `.env` nunca se sube.
- Ajustes muestra qué proveedor/modelo está usando cada agente y **de dónde viene** (env, ajustes o default).

**Autocorrección: los errores vuelven al agente.** Un solo helper (`runAgent`) para todos los agentes:
1. Llama al modelo.
2. **Valida** la respuesta (JSON + schema con zod; acciones: que existan los IDs, campos válidos, fechas correctas...).
3. Si falla, **le reenvía al agente su respuesta y el error exacto** ("Tu respuesta falló porque: ... Corrígela y responde solo con JSON válido según el schema") y vuelve a intentar.
4. Lo mismo si una **acción falla al ejecutarse** (ej. "no existe la tarea X"): el error vuelve al agente para que corrija o pregunte.
5. Máximo **2 reintentos** por proveedor; si sigue fallando, pasa al siguiente proveedor del modo auto; si todos fallan, mensaje amable al usuario.
- Cada intento queda en un **log** (`logs/agents.log`, sin datos sensibles) con: agente, proveedor, modelo, error y si se corrigió. Útil para demostrar el mecanismo.
- Tests: casos con respuestas inválidas simuladas (proveedor falso) que prueban que el agente recibe el error y se corrige.

## 9. Features

### 9.0 Centro de control (navegación)
La ventana principal de Nuggit tiene una **barra lateral** con pestañas. Cada pestaña es un panel a pantalla completa:
- **Inicio**: el tablero de widgets (lo que ya existe).
- **Dip**: el chat con Dip en grande, con historial.
- **Tareas**: la lista de tareas completa, con subtareas/tenders, filtros simples (hoy, pendientes, hechas).
- **Ahora**: Next Action ("¿Qué hago ahora?", 9.5) en grande.
- **Tenderizer**: dividir una tarea grande en tenders (9.3) en grande.
- **Dailies**: las rutinas que se repiten (9.13).
- **Notas**: Quick Notes (9.7).
- **Brain Dump**: soltar todo y ordenarlo (9.6).
- **Focus**: el temporizador (9.8), con la entrada a Lockdown (9.9).
- **Ajustes**: Settings (IA, personalidad de Dip, barra de menú, tema...).
- Toda feature útil tiene su pestaña.

Reglas:
- El panel y el widget de una misma feature usan **el mismo componente** (prop `size: "widget" | "full"`), para no duplicar código ni diseño.
- La barra lateral es colapsable (solo íconos) y responsive.
- Atajos de teclado: ⌘1 Inicio, ⌘2 Dip, ⌘3 Tareas, ⌘4 Ahora, ⌘5 Tenderizer, ⌘6 Dailies, ⌘7 Notas, ⌘8 Brain Dump, ⌘9 Focus, ⌘, Ajustes. ⌘N: nota rápida.
- **Ajustes dividido en pestañas** (dentro de Ajustes), para no tener todo en una sola página:
  - **General** (idioma, abrir al iniciar la Mac, atajos)
  - **Apariencia** (tema, colores, fondos — Fase 9)
  - **Dip** (personalidad)
  - **IA y proveedores** (Gemini, Ollama, servidor propio, orden del modo auto, modelo por agente)
  - **Voz** (elegir voz, velocidad, tono, probar; modo llamada)
  - **Widgets** (opciones generales, pin, quick pickup)
  - **Barra de menú** (íconos de Nuggit, Dip y quick pickup)
  - **Calendario** (cuando exista — Fase 8.5)
  - **Acerca de** (versión, novedades)
  - Buscador arriba para encontrar cualquier ajuste rápido. Recordar la última pestaña abierta.
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

Memoria del chat (audit de costos, hallazgo 5):
- Dip ya no recibe los últimos 30 mensajes enteros: recibe un **resumen** (máx. 100 palabras) de lo viejo y los mensajes recientes completos (entre 6 y 11). El historial en pantalla no cambia.
- El resumen avanza de 6 en 6 en segundo plano después de que Dip contesta, y se guarda en `dip-chat.json` (`memory`). Si la persona escribe mientras se resume, se cancela y se reintenta después, así su mensaje nunca espera. Si resumir falla, los mensajes van completos (tope 30). "Borrar chat" borra también el resumen.
- Lógica en `src/main/ai/chatMemory.ts` (sin Electron, con tests).

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
- **Pestaña "Voz" en Ajustes** con **varias voces para elegir**: lista las voces del sistema (agrupadas por idioma, marcando "Mejorada"/"Premium"), cada una con botón ▶️ para escucharla, más velocidad y tono. Por defecto, la mejor voz en español disponible. Si hay pocas voces buenas, mostrar cómo descargar más (Ajustes del Sistema → Accesibilidad → Contenido leído → Gestionar voces).
- **Modo llamada 📞** (como el modo voz de ChatGPT/Gemini/Claude): conversación manos libres con Dip.
  - Botón **"Llamar a Dip"** (en la pestaña Dip y en el mini chat de la barra de menú). Se abre una pantallita de llamada: animación que reacciona a la voz, estado (escuchando / pensando / hablando) y botones **Silenciar** y **Colgar**.
  - Ciclo: escucha → detecta cuando el usuario terminó de hablar (VAD, detección de silencio) → transcribe → Dip responde (respuestas cortas, estilo hablado) → lo dice en voz alta → vuelve a escuchar.
  - **Interrumpir**: si el usuario habla mientras Dip habla, Dip se calla y escucha.
  - Transcripción (voz → texto): local con **whisper.cpp** (modelo pequeño, gratis y privado) o un endpoint de transcripción del proveedor si existe. Configurable como los demás proveedores (8.1).
  - Voz (texto → voz): voces del sistema por defecto; opción futura de voces neuronales más naturales.
  - Durante la llamada Dip puede usar sus acciones (crear tareas, etc.) y las confirma **por voz** ("¿La guardo?" → "sí").
  - Todo queda en el mismo historial de Dip, como texto.
  - Permiso de micrófono de macOS pedido solo la primera vez, con explicación.


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

### 9.16 Widgets siempre visibles, fijos y "quick pickup"
**Pin on top (siempre al frente).** Cualquier widget que el usuario elija se puede poner **siempre encima** de todas las ventanas (ideal para "¿Qué hago ahora?", Dip o el timer):
- Se quedan visibles aunque hagas clic en otra app.
- Opción "En todos los escritorios": siguen visibles al cambiar de escritorio (Spaces) y encima de apps en pantalla completa.
- En Electron: `setAlwaysOnTop(true, "floating")` y `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
- Lo elige el usuario, widget por widget, y **solo se maneja desde el quick pickup** (no desde el engranaje normal). Por defecto apagado en todos.

**Pin on back (siempre al fondo).** Opción en el engranaje normal (parte de arriba, opciones generales) de cualquier widget despegado:
- El widget se queda **detrás de todas las ventanas**, aunque le hagas clic. Nunca sube al frente ni tapa otras cosas.
- Objetivo: que se comporte como parte del fondo de pantalla, idealmente **detrás de los archivos e íconos del escritorio** (ej. screenshots guardados en el Escritorio quedan por encima del widget).
- Implementación a probar en macOS: `BrowserWindow` con `type: "desktop"` (nivel de ventana del escritorio). Verificar que el widget siga recibiendo clics para sus botones; si no, ofrecer el modo "fondo" sin interacción y desactivarlo con el atajo o desde el quick pickup.
- "Pin on top" y "Pin on back" no pueden estar activos a la vez.

**Fijar (pin) de verdad.** Hoy el pin no hace nada; debe funcionar así:
- Se fija con el botón **📌** del encabezado del widget (visible al pasar el mouse), no desde el engranaje.
- Un widget fijado **no se puede mover ni redimensionar**.
- Desaparecen todos los controles de edición (bordes de resize, arrastre, cerrar, engranaje...). Solo queda un **candadito** pequeño para desfijar (visible al pasar el mouse).
- Funciona igual en el tablero y en los widgets despegados al escritorio.
- Fijar + "siempre al frente" + "en todos los escritorios" = el widget queda clavado en la pantalla pase lo que pase.

**Menú del engranaje (estructura).** Todos los widgets usan el mismo menú, en dos partes separadas por una línea divisoria:
1. **Arriba — opciones generales** (iguales para cualquier widget): Sombra, Pin on back, Transparencia, Fondo (color/imagen). "Fijar" no va aquí (es el botón 📌) y "Siempre al frente" tampoco: se maneja solo desde el quick pickup.
2. **Abajo — opciones propias del widget** (las define cada widget en su `settingsComponent`). Ej. reloj: mostrar segundos, formato 12 horas.
Si un widget no tiene opciones propias, no se muestra la línea ni la parte de abajo.

**Quick pickup (ícono propio en la barra de menú).** Otro ícono en la barra de menú para sacar widgets rápido:
- Al hacer clic se abre una ventanita con un **buscador** y la lista de widgets (los abiertos y los que se pueden añadir), con su ícono.
- Al elegir uno que no está abierto, aparece **despegado en el escritorio** al instante.
- Cada widget de la lista tiene su botón de **Ajustes** con la opción **"Pin on top"**: el widget se queda siempre encima de las demás ventanas (y opción "En todos los escritorios"). Desde ahí mismo se quita.
- Muestra también los widgets que ya están abiertos, para traerlos al frente o cerrarlos.
- En Ajustes se puede ocultar este ícono o **unirlo al menú de Nuggit** (9.11) si hay demasiados íconos en la barra.

### 9.17 Widget de imagen
Un widget que solo muestra imágenes, para decorar el escritorio.
- Elegir **una imagen** o **varias** (carrusel que cambia cada X segundos, configurable).
- Ajuste de la imagen: rellenar, ajustar o centrar. Esquinas redondeadas como los demás widgets.
- Las imágenes se **copian** a la carpeta de datos de Nuggit para que no se pierdan si se mueve el archivo original.
- Funciona en el tablero y despegado al escritorio, con las opciones generales (fijar, sombra, transparencia...) y, desde el quick pickup, "Pin on top".

### 9.19 Música en Focus (Spotify)
Poner música mientras corre el Pomodoro/Focus.
- **Paso 1 (simple, sin login):** controlar la **app de Spotify** de la Mac con AppleScript (`osascript`): reproducir, pausar, siguiente, y abrir una playlist por su link/URI. El usuario pega en Ajustes el link de su "playlist de focus" (y opcional otra para los descansos).
- Comportamiento: al empezar el focus → suena la playlist de focus; al empezar el descanso → pausa o cambia a la de descanso; al terminar/cancelar → pausa. Todo opcional y configurable.
- Mini controles (⏯ ⏭ y nombre de la canción) dentro del widget de Focus y en Lockdown.
- Si Spotify no está instalado o abierto, mostrar un aviso amable y seguir sin música.
- **Paso 2 (después):** conectar la cuenta con la **Web API oficial de Spotify** (login OAuth con PKCE) **solo para leer** las playlists del usuario y elegirlas desde Nuggit sin pegar links. La reproducción se sigue haciendo por AppleScript (paso 1), así **no hace falta Spotify Premium** (la Web API solo exige Premium para controlar la reproducción).
- Pestaña en Ajustes: "Música".
- **Música sin Focus** (para usarla en cualquier momento):
  - **Widget "Música"** 🎵: carátula (si se puede), canción y artista, ⏮ ⏯ ⏭, volumen y botón para elegir playlist. Funciona como cualquier widget: tablero, despegado, fijar, Pin on top / Pin on back.
  - **Ícono propio en la barra de menú** 🎵: al hacer clic, mini reproductor flotante con los mismos controles. Opción en Ajustes → Barra de menú para mostrarlo, ocultarlo o unirlo al menú de Nuggit.
  - Si Spotify no está abierto, botón "Abrir Spotify".

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

### Fase 5.3 — Widgets siempre visibles, pin y quick pickup
- Arreglar el **pin** según 9.16 (no se mueve, sin controles de edición, solo candado para desfijar).
- "Pin on top" y "En todos los escritorios" desde el quick pickup.
- "Pin on back" desde el engranaje (detrás de todo, idealmente detrás de los archivos del Escritorio).
- Ícono de **quick pickup** en la barra de menú.
- **Listo cuando:** fijo "¿Qué hago ahora?" siempre al frente, cambio de app y de escritorio y sigue ahí sin poder moverlo; y desde el quick pickup saco el timer al escritorio con un clic.

Cómo quedó (Fase 5.3):
- Pin on back usa `type: "desktop"`: queda detrás de los archivos del Escritorio, pero macOS no le manda clics. Se quita desde el quick pickup. Como macOS fija el tipo de ventana al crearla, activarlo o quitarlo vuelve a abrir la ventana.
- Transparencia y Fondo por widget quedan para la Fase 9 (ver ahí). Sombra y Pin on back solo aplican a widgets despegados.
- Cerrar desde el quick pickup: un widget despegado vuelve al tablero; uno del tablero se oculta.
- Si el quick pickup está "dentro del menú de Nuggit", se abre desde "🧩 Widgets…" de ese menú, que solo aparece mientras hay algo en curso.

### Fase 5.5 — Dailies
- Dailies según 9.13: crear, repetir por días, marcarlos hechos, y planearlos con Dip (con aprobación).
- **Listo cuando:** creo "gimnasio" solo los miércoles y "bañarme" todos los días, y el miércoles aparecen los dos en hoy y el jueves solo "bañarme".

Cómo quedó (Fase 5.5):
- Los dailies viven en `dailies.json`. Cada día, cada daily que toca se vuelve una **tarea real de hoy** (con 🔁), así sale en Tareas, en Ahora, en la barra de menú y en el contexto de Dip sin código aparte. Marcarla como hecha es marcar el daily.
- Al cambiar de día, las copias de ayer se quitan solas: lo hecho queda en el historial del daily (para la racha) y lo pendiente no se acumula como atrasado (sin culpa).
- Si borras la copia de hoy a mano, no vuelve hasta el próximo día que toque.
- Racha: solo se muestra desde 2 seguidas (🔥 3) y los días que no tocan no la rompen. Si se rompe, simplemente desaparece.
- Pestaña **Dailies** (⌘6) y widget, con "Planear con Dip" (preguntas → propuesta editable → Guardar, con Deshacer).

### Fase 5.7 — Agentes configurables + autocorrección (para el lunes)
- Según 8.1: agentes separados, `.env` / variables de entorno con prioridad sobre Ajustes, `config/ai.defaults.json`, `.env.example`.
- `runAgent` con validación y reenvío de errores al agente (máx. 2 reintentos), log de intentos y tests.
- **Listo cuando:** cambio `NUGGIT_AI_PROVIDER` y `NUGGIT_AI_MODEL` en `.env`, reinicio, y Dip usa ese proveedor/modelo sin tocar código; y en el log se ve un caso donde el Tenderizer devolvió JSON inválido, recibió el error y se corrigió solo.

Cómo quedó (Fase 5.7):
- Agentes en `src/main/ai/agents/`: `dip` (chat, personalidad, "Solo empieza"), `actions`, `tenderizer`, `dailies`. Cada uno: nombre, instrucciones, schema JSON para el proveedor + schema zod que valida, y `tools` (solo `actions` puede proponer create/complete/update).
- `config/ai.defaults.json` (validado con zod al arrancar) · `.env.example` documentado. `.env` se busca en la carpeta del proyecto, la carpeta actual o la de datos; las variables reales mandan sobre `.env`. En auto, `NUGGIT_AI_MODEL` es para el primero del orden. Extras: `NUGGIT_GEMINI_MODEL`, `NUGGIT_OLLAMA_MODEL`.
- `runAgent` (sin Electron, con tests): un error del proveedor (caído, sin key) pasa directo al siguiente; una respuesta inválida se le devuelve al agente con el error exacto, máx. 2 reintentos. En `actions`, "no existe la tarea X" vuelve al agente, que corrige o pregunta (la ejecución real sigue siendo después de que la persona confirma).
- Log: `logs/agents.log` en la carpeta de datos, una línea JSON por intento; el texto entre comillas se borra. Rota a `.old` pasando 1 MB.
- Cada intento lleva además `tokensIn`, `tokensOut` (incluye thinking), `ms` y `costUsd` estimado (audit de costos, hallazgo 2). Ollama y el servidor propio cuestan 0; Gemini usa `geminiPricesPerMillionTokens` de `config/ai.defaults.json` (se actualiza a mano); `null` si el modelo no está en la tabla o el proveedor no da tokens.
- Las llamadas se pueden cancelar (`signal`): se corta al instante, sin reintentos ni otros proveedores.
- Ajustes → IA de Dip → "🧠 Agentes": IA y modelo de cada agente y de dónde viene (.env / Ajustes / por defecto), qué `.env` se cargó y dónde está el log.
- Demo para clase: `NUGGIT_DEMO_BREAK_FIRST_ANSWER=tenderizer` corta a la mitad la primera respuesta de ese agente; en el log sale `"demo": true`. Con la IA de verdad, el schema casi nunca falla, así que esto sirve para mostrarlo a voluntad.
- Tests: `npm test` (vitest, proveedor falso).

### Fase 6 — Brain Dump + Quick Notes

Cómo quedó (Fase 6):
- **Notas** (`notes.json`, widget + pestaña ⌘7): "+ Nota" en un clic o **⌘N** desde cualquier pestaña de la ventana principal (abre Notas con el cursor en la nota nueva). Se guardan solas mientras escribes; una nota que dejas vacía se borra sola; borrar tiene "Deshacer". Más de 3 notas → buscador.
- **Brain Dump** (widget + pestaña ⌘8): una caja grande; lo que escribes se recuerda aunque cambies de pestaña (solo en este equipo). Con IA, "✨ Ordenar con Dip" usa el agente nuevo **`brainDump`** (8.1: schema, validación y autocorrección como los demás) y muestra tareas (nombre, fecha, ❗ urgente) y notas para editar o quitar; nada se guarda hasta "Guardar", y luego hay "Deshacer". Sin IA (o con "Mejor como una nota"), todo se guarda como una nota.
- El texto del Brain Dump solo va a la IA al presionar "Ordenar con Dip"; no se le mandan las tareas existentes.
- ⌘N es dentro de la app; un atajo global (desde cualquier app) queda para después si hace falta.

### Fase 7 — Focus + Lockdown

Cómo quedó (Fase 7):
- **Focus** (widget + pestaña ⌘9): 25/5, 15/5 o Personalizado (1–180 min). Empezar, Pausa/Seguir y Cancelar; en el descanso, "Saltar descanso". Cambiar los tiempos con el reloj andando conserva lo ya hecho (si el nuevo tiempo ya pasó, la fase termina).
- El temporizador vive en el proceso main (`focus.json`): widget, pestaña, ventana despegada y Lockdown muestran lo mismo, sigue corriendo sin ventanas y sobrevive a reiniciar Nuggit. Al terminar la concentración empieza el descanso solo; al terminar el descanso, espera. Un solo aviso del sistema por fase, sin más.
- **Tarea actual:** la que elijas en la lista, o si no la de "¿Qué hago ahora?" (mismas reglas, `focusAction` en `src/shared/nextAction.ts`). Empezar la marca "En curso". "✅ Hecho" la completa y pasa sola al siguiente paso. Cuenta las rondas del día.
- **Lockdown** (botón 🔒 en Focus): cubre la ventana principal con solo la tarea, el reloj, sus botones y el siguiente paso. Esconde los widgets despegados y los devuelve al salir. Salida siempre visible (botón "Salir" + Esc). Cerrar la ventana también sale, y Lockdown nunca vuelve solo al abrir Nuggit. No bloquea nada fuera de la app.

### Fase 8 — Voz básica

Cómo quedó (Fase 8):
- **Hablarle a Dip:** botón 🎤 en el chat de Dip (widget, pestaña y mini chat) y en Brain Dump. Pone el cursor en el campo y abre el **dictado de macOS** (`Menu.sendActionToFirstResponder('startDictation:')`, lo mismo que Edición → Iniciar dictado). El texto lo hace macOS; Nuggit no graba ni manda audio. También sirve Fn (🌐) dos veces en cualquier campo. El reconocimiento de voz de Chromium no se usa: en Electron no funciona sin claves de Google.
- **Dip contesta hablando:** se prende y apaga con 🔊/🔇 en el chat o en Ajustes (`settings.voice`). Solo habla la ventana desde donde se preguntó (el chat se comparte entre varias). Antes de leer quita emojis, markdown y links. Si cambias de mensaje o lo apagas, se calla.
- **En Mac la voz sale de `say`, no de `speechSynthesis`:** Chromium no dice qué voces son "Mejorada"/"Premium" (ni garantiza usarlas), y `say -v '?'` sí. `say` hace un WAV corto en el proceso main y la ventana lo reproduce (`media-src blob:` en la CSP). El tono se cambia al reproducir (`playbackRate` sin conservar el tono) y `say` habla más lento en la misma medida, así velocidad y tono son independientes. Fuera de Mac se usa `speechSynthesis`.
- **Ajustes → 🎙️ Voz:** lista de voces del sistema en español e inglés, ordenadas por calidad y marcadas ⭐ Premium / ✨ Mejorada / robótica (las de efectos, como Bubbles, no salen). Por defecto, "La mejor disponible": Premium > Mejorada > normal > robótica; entre iguales, la región del sistema y luego Latinoamérica. Si la respuesta está en el otro idioma se usa la mejor voz de ese idioma. Velocidad (0.5–2×), tono (0.8–1.25), "▶ Probar", "⏹ Parar" y "Actualizar voces". Si no hay voces Mejoradas/Premium en español, explica cómo bajarlas gratis (Accesibilidad → Contenido leído → Administrar voces) con botón a Accesibilidad. También cómo activar el dictado.
- Reglas de calidad y lectura de `say` en `src/shared/voices.ts` (con tests).
- La voz es parte de Dip y Brain Dump, así que no tiene pestaña propia: su lugar es Ajustes.

### Fase 8.3 — Mejor voz + modo llamada
- **Ajustes en pestañas** (ver 9.0) y pestaña **Voz** con varias voces para elegir, según 9.10.
- **Modo llamada** con Dip: manos libres, detección de silencio, interrupción, pantallita de llamada.
- **Listo cuando:** le doy a "Llamar a Dip", hablo sin tocar nada, me contesta con una voz natural, lo interrumpo y se calla, y le digo "anota tarea de inglés para mañana", me pregunta si la guardo, digo "sí" y aparece en Tareas.

Cómo quedó (Fase 8.3):
- **Ajustes en pestañas:** General (abrir al iniciar la Mac, idioma, atajos), Apariencia, Dip, IA y proveedores, Voz (voz + modo llamada), Barra de menú y Acerca de (versión, carpeta de datos y lo último del CHANGELOG). Buscador arriba: busca por palabras en todas las pestañas y muestra "En Voz →" para ir a la pestaña. Recuerda la última pestaña (`ui.settingsTab`). **Widgets** y **Calendario** no tienen pestaña todavía: no hay ajustes de widgets generales aún (el quick pickup está en Barra de menú) y Calendario llega en la Fase 8.5.
- **Voz:** lista de voces agrupada por idioma (Español abierto, English plegado), marcando ⭐ Premium / ✨ Mejorada / robótica, con ▶ en cada una (usa la velocidad y el tono actuales).
- **Modo llamada 📞** (botón en el chat de Dip: widget, pestaña y mini chat de la barra de menú):
  - Pantallita encima del chat: círculo que crece con tu voz, estado (Te escucho / Escuchando / Pensando / Dip está hablando), lo último que dijiste y lo último que dijo Dip, **Silenciar** y **Colgar** (o Esc).
  - Ciclo: micrófono → detección de voz (`voice/call/vad.ts`: aprende el ruido del cuarto, 900 ms de silencio = terminaste) → WAV 16 kHz → transcripción → `dipChat.send(texto, { voice: true })` → Dip contesta corto y hablado (instrucción extra en el agente `actions`) → se dice en voz alta → vuelve a escuchar.
  - **Interrumpir:** mientras Dip habla, el umbral sube (para que su propia voz por los parlantes no cuente) y si hablas más fuerte, Dip se calla y te escucha. Con audífonos funciona mejor.
  - **Confirmar por voz:** si hay una tarjeta de acción pendiente, un "sí"/"dale"/"no"/"mejor no" corto la guarda o la cancela (`confirm.ts`). Una respuesta larga va a Dip como mensaje normal.
  - Todo queda en el historial del chat como texto.
  - **Transcripción (`src/main/stt.ts`), configurable como 8.1:** whisper.cpp en esta Mac (`brew install whisper-cpp` + modelo base 148 MB o small 488 MB que se baja desde Ajustes a `userData/models`), el `/audio/transcriptions` de tu servidor, o Gemini. Automático usa el orden de `config/ai.defaults.json`. Variables: `NUGGIT_STT_PROVIDER`, `NUGGIT_WHISPER_BIN`, `NUGGIT_WHISPER_MODEL`, `NUGGIT_STT_MODEL`. Se filtran las "alucinaciones" típicas de whisper en silencio ("Subtítulos por la comunidad de Amara.org"…). El primer uso de whisper en la sesión es lento (prepara la GPU): se calienta al abrir la llamada.
  - Idioma: automático usa el idioma de la conversación como pista (un "sí" suelto se confundía con inglés); se puede fijar en Ajustes.
  - **Micrófono:** antes de que macOS pregunte, la pantallita explica para qué es; si se negó, lleva a Privacidad → Micrófono. El texto del permiso en `electron-builder.yml` también lo explica.
  - Se probó de punta a punta con el micrófono falso de Chromium (`--use-file-for-fake-audio-capture`) y Ollama: interrupción, "anota tarea de inglés para mañana" → tarjeta → "sí" → tarea guardada para mañana.

### Fase 8.5 — Calendario
- Vista de calendario (pestaña + widget) según 9.14.
- Paso 1: exportar a `.ics` (Apple y Google). Paso 2: Apple Calendar en dos vías. Paso 3 (si da tiempo): Google Calendar en dos vías.
- **Listo cuando:** veo mis tareas y dailies en el calendario de Nuggit y también aparecen en mi calendario del Mac.

Cómo quedó (Fase 8.5):
- **Pestaña Calendario (⌘0) y widget** (mismo componente): en grande, el mes (lunes primero) con el día elegido al lado (abajo si la ventana es angosta); en chico, los próximos 7 días. Muestra tareas con fecha (se marcan hechas ahí mismo), dailies (desde el día en que se crearon, con ✓ si se hicieron) y eventos de los calendarios de la Mac que elijas. "Anotar una tarea para este día" crea una tarea con esa fecha. Reglas en `src/shared/calendar.ts` (con tests).
- **Paso 1 — .ics:** "Exportar .ics" (para importar en Google Calendar o cualquier app; es una copia) y **suscripción**: un feed en `webcal://127.0.0.1:47321/nuggit.ics` que Calendario de la Mac sigue solo, sin permisos (solo lectura allá; funciona mientras Nuggit está abierto). Tareas como eventos de todo el día; dailies como eventos que se repiten (`RRULE`), con hora y duración si la tienen.
- **Paso 2 — Calendario de la Mac en dos vías** (`src/main/calendar/apple.ts`, con JavaScript for Automation, no EventKit: EventKit necesita una app firmada con su propio permiso, que en desarrollo no hay). macOS pregunta una vez si Nuggit puede controlar Calendario.
  - Nuggit escribe solo en su propio calendario **"Nuggit"** (lo crea si no está) y encuentra sus eventos por la marca `(nuggit:task:…)` en las notas. Los demás calendarios solo se leen, nunca se cambian.
  - Si mueves una tarea a otro día en Calendario, la tarea se mueve en Nuggit (se compara con lo último que Nuggit escribió, en `calendar-sync.json`).
  - **Sincronizar: Automático o Manual** (lo elige la persona): automático = a los pocos segundos de cada cambio y cada 10 minutos; manual = solo con "Sincronizar ahora".
  - Límite: los eventos que se repiten aparecen en Nuggit solo el día en que empezó la serie (el scripting de Calendario no da cada repetición).
- **Ajustes → Calendario**: dos vías (con qué calendarios mostrar y cómo sincronizar), suscripción, exportar, y aviso si suscripción y dos vías están prendidas a la vez (se verían las tareas dos veces).
- **Paso 3 — Google Calendar en dos vías: no se hizo** (necesita un proyecto de Google Cloud y OAuth). Mientras, Exportar .ics.

### Fase 8.7 — Música en Focus (Spotify)
- Paso 1 de 9.19: controlar la app de Spotify con AppleScript, playlists de focus/descanso, mini controles.
- **Listo cuando:** pego mi playlist en Ajustes, empiezo un Pomodoro y suena sola; en el descanso se pausa; y puedo pasar de canción desde el widget de Focus.

Cómo quedó (Fase 8.7):
- **Ajustes → Música:** "Poner música durante Focus", la playlist para concentrarte (se pega el link de Spotify; acepta `open.spotify.com/…` con o sin `/intl-es/` y `spotify:…`, y se guarda como URI: `src/shared/music.ts`, con tests), qué hacer en el descanso (pausar o poner otra playlist) y "▶ Probar". Muestra si Spotify está instalado/abierto **sin pedir permiso** (solo revisa si la app está abierta).
- **Control por AppleScript** (`src/main/music.ts`): `play track "spotify:playlist:…"`, `playpause`, `next track`, `pause`. No hace falta login ni Premium (con Spotify gratis salen anuncios). macOS pregunta una vez si Nuggit puede controlar Spotify (la espera alcanza para contestar el aviso).
- **Con Focus** (`src/main/focus.ts`): empezar → suena la playlist; pausar/seguir el reloj → la música también; descanso → pausa (o la otra playlist); terminar o cancelar → pausa. Solo pausa música que puso Nuggit (al empezar, con "Probar" o con sus ⏯ ⏭), nunca algo que ya estabas escuchando por tu cuenta.
- **Mini controles** (🎵 canción · artista, ⏯, ⏭) en el widget de Focus y en Lockdown, solo con la música prendida. Si Spotify está cerrado: aviso amable + "Abrir Spotify"; Nuggit nunca lo abre solo y Focus sigue sin música.
- Probado en vivo con Spotify (gratis): suena al empezar, ⏭ pasa de canción, pausa/sigue con el reloj, se pausa en el descanso y al cancelar.

### Fase 8.8 — Widget de música + ícono en la barra de menú
- Según 9.19 ("Música sin Focus"): widget Música y mini reproductor desde su propio ícono en la barra de menú.
- **Listo cuando:** sin abrir Focus, controlo Spotify desde el widget fijado en mi escritorio y desde el ícono de la barra de menú.

Cómo quedó (Fase 8.8):
- **Widget y pestaña "Música" 🎵** (mismo componente; la pestaña no tiene atajo porque ⌘1–⌘0 ya están usados): carátula, canción y artista, barra de tiempo, ⏮ ⏯ ⏭, volumen y **🎶 Playlists**. Como cualquier widget: tablero, despegado, fijar, Pin on top / Pin on back.
- **Elegir playlist:** se guardan pegando el link una vez; el nombre y la imagen salen del oEmbed público de Spotify (sin login). También aparecen las playlists de Focus. Un clic la pone. Máximo 20.
- **Ícono propio en la barra de menú** (nota musical dibujada en código, como el del quick pickup) con el mismo reproductor en una ventanita flotante (`?view=music`). En Ajustes → Barra de menú: con su ícono, dentro del menú de Nuggit (que solo aparece con algo en curso) u oculto. Si nunca se eligió, el ícono sale solo si Spotify está instalado.
- **Datos de Spotify** (`src/main/music.ts`): estado, volumen, canción, artista, carátula, posición y duración, cada uno por separado (un anuncio o nada cargado no tiene todos). Se revisa cada 2 s solo mientras el reproductor está a la vista; entre revisiones el tiempo avanza solo. La carátula viene de los servidores de Spotify (CSP: `img-src https://*.scdn.co https://*.spotifycdn.com`).
- Si Spotify está cerrado: "Abrir Spotify". Si no hay nada cargado (pasa después de un anuncio en Spotify gratis), ⏯ no tiene qué reanudar: se elige una playlist.

### Fase 9 — Pulido visual + personalización
- Animaciones suaves y detalles de diseño.
- **Personalización** en Ajustes → "Apariencia": elegir tema (claro/oscuro/sistema), **color de acento**, **fondo** del tablero (colores o imagen propia), y estilo de los widgets (sombra, transparencia, esquinas).
- **Fondo de los widgets** con dos niveles:
  - **General**: un color o una imagen para todos los widgets (Ajustes → Apariencia).
  - **Por widget**: desde el engranaje (parte de arriba, opciones generales), cada widget puede tener **su propio color o imagen**, que manda sobre el general. Botón "Usar el general".
  - Con imagen, el texto debe seguir leyéndose (capa oscura/clara automática encima de la imagen).
- **Widget de imagen** (9.17).
- Ícono y logo definitivos de Nuggit.

Cómo quedó (Fase 9):
- **Ajustes → Apariencia:** tema; **color de acento** (Lavanda, Azul, Menta, Durazno, Rosa, Sol o cualquier color; cada uno con su versión clara y oscura, y el texto encima se elige solo para que se lea); **fondo del tablero** (normal, un color o una imagen propia); y **widgets**: fondo para todos, transparencia (0–40 %), esquinas (rectas, suaves, muy redondas) y sombra en el tablero.
- **Fondo de los widgets en dos niveles:** el general (Apariencia) y el de cada widget desde su ⚙︎ (arriba, en las opciones generales, que ahora tienen todos los widgets): "Usar el general", normal, un color o una imagen. Con imagen se pone un velo del color del tema (claro u oscuro) para que el texto se lea; con un color, el texto se vuelve claro u oscuro según el color. Funciona igual en el tablero y despegado (`src/renderer/src/theme/appearance.ts`, variables CSS `--widget-*`).
- **Imágenes:** se **copian** a la carpeta de datos (`images/`, nombre generado) para no depender del archivo original; las fotos HEIC del iPhone se pasan a JPEG. Se muestran con el protocolo `nuggit-img://`, que solo sirve esa carpeta. Al abrir Nuggit se borran las copias que ya nada usa.
- **Widget de imagen (9.17):** una o varias imágenes; con varias cambian solas (5 s a 30 min) con un fundido; Rellenar, Ajustar o Centrar. El encabezado aparece solo al pasar el mouse, encima de la imagen. Es decoración, así que no tiene pestaña propia.
- **Detalles suaves:** las pestañas y secciones de Ajustes entran con un fundido corto, los widgets aparecen con un "pop" suave, los menús caen, y los botones responden al clic. Si la Mac tiene "Reducir movimiento", casi no hay animación.
- **Ícono y logo:** un nugget dorado sonriente con su salsita (Dip) lavanda sobre navy, sin pollo (`resources/brand/nuggit-icon.svg` → `build/icon.icns`, `.ico`, `.png` y `resources/icon.png`). Sale en la barra lateral y, mientras se desarrolla, en el Dock.

### Fase 10 — Ayuda, tutorial y FAQ
- **Bienvenida (primera vez que se abre):** un tour corto de 4–5 pasos con burbujitas que señalan cada parte: el tablero, cómo despegar widgets, la barra de menú, Dip y Ajustes. Botón "Saltar" siempre visible. Se puede repetir desde Ayuda.
- **Pestaña "Ayuda"** en el centro de control con:
  - **Cómo se usa** cada feature (tareas, tenders, Dip, Focus, Lockdown, widgets, barra de menú), con explicaciones cortas.
  - **Dónde personalizar** cada cosa (colores, fondo, tema, personalidad de Dip, barra de menú), con botón que lleva directo a ese ajuste.
  - **FAQ**: preguntas frecuentes (¿Funciona sin internet? ¿Dónde se guardan mis datos? ¿Cómo conecto Gemini u Ollama? ¿Cómo salgo de Lockdown? ¿Cómo regreso un widget al tablero?...).
  - **Atajos de teclado**.
  - **Novedades (update log)**: muestra `CHANGELOG.md` de forma bonita, versión por versión.
  - Botón **"Únete al Discord de Nuggit"** en Novedades (y en la ventanita de "Qué hay de nuevo"), para que la gente reaccione, comente y comparta ideas en el servidor. El link de invitación va en un archivo de configuración (`config/community.json`), no escrito en el código. Si todavía no hay link, el botón no se muestra.
- Al abrir Nuggit después de una actualización, aparece una ventanita "Qué hay de nuevo en la versión X" (con botón "Ver todo" y "Cerrar"). Se puede apagar en Ajustes.
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
