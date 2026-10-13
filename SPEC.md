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
5. **Una sola pantalla principal** (el escritorio de widgets) + Settings. Las features nuevas son **widgets**, no pantallas nuevas.
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
      (futuro) openai.ts, claude.ts, ollama.ts
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
    provider: "none" | "gemini";   // más proveedores después
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

- **Fase actual:** Gemini con API key gratuita de Google AI Studio. El usuario la pega en Settings.
- **Después:** "Sign in with ChatGPT" (OpenAI, para apps open-source y locales), Claude con API key, modelos locales con Ollama.

---

## 9. Features

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

### Fase 3 — Conectar Gemini + Dip
- Settings: pegar la API key de Gemini (guardada con `safeStorage`), botón "Probar conexión", interruptor "Compartir tareas con la IA".
- Widget de Dip con chat básico.
- Guía corta dentro de Settings de cómo sacar la key gratis.
- **Listo cuando:** le pregunto algo y contesta. Sin key, la app funciona igual y el widget dice amablemente cómo conectarla.

### Fase 4 — Tenders
- Flujo completo de la sección 9.3.
- **Listo cuando:** le doy "proyecto de ciencias", me hace preguntas y me guarda los tenders después de confirmar.

### Fase 5 — Next Action + "ya terminé"
- Conectar la barra de menú (9.11) con Next Action: misma tarea y mismo siguiente paso.
- Widget Next Action con las reglas de 9.5.
- En el chat, "ya terminé X" propone marcarla como hecha y sugiere la siguiente.
- **Listo cuando:** abro la app y sé qué hacer en menos de 5 segundos.

### Fase 6 — Brain Dump + Quick Notes

### Fase 7 — Focus + Lockdown

### Fase 8 — Voz básica

### Fase 9 — Pulido visual
Animaciones suaves, detalles de diseño, fondos, más temas.

### Después del MVP (ideas)
QOTD (banco de preguntas incluido + generadas por código + IA para conversar), Calendario, School, Recordatorios (con la app en la barra de menú), tareas recurrentes, exportar/backup, más proveedores de IA, voz en tiempo real, versión para celular.

---

## 12. Cómo trabajar con este spec

En cada sesión con la terminal:

```
Lee SPEC.md. Haz solo la Fase N. Al terminar, dime cómo probarla.
```

Si algo del spec no tiene sentido o es muy difícil, la terminal debe **decirlo y proponer una alternativa** antes de construir.
