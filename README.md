# Nuggit

**ES** · Una app de escritorio que te ayuda a empezar tus tareas, organizarte y no perder el foco. Con widgets, y con **Dip**, un ayudante con IA que convierte una tarea grande en pasitos (los *Tenders*).

**EN** · A desktop app that helps you start tasks, stay organized and keep your focus. It has widgets, plus **Dip**, an AI helper that breaks a big task into small steps (the *Tenders*).

> Hecha primero para **Mac**. Windows y Linux todavía no se han probado. Mira [Compatibilidad](#-compatibilidad--compatibility).
>
> *Made for **Mac** first. Windows and Linux are untested. See [Compatibility](#-compatibilidad--compatibility).*

---

## ⬇️ Descargar / Download

Las versiones listas para instalar estarán en la página de [**Releases**](../../releases).

*Ready-to-install versions will be on the [**Releases**](../../releases) page.*

### ⚠️ Antes de abrirla / Before you open it

Nuggit todavía **no está firmada** por Apple ni por Microsoft, así que tu computadora te va a avisar la primera vez. Es normal.

*Nuggit is **not signed** by Apple or Microsoft yet, so your computer will warn you the first time. That's expected.*

- **Mac:** si dice que "no se puede abrir", haz **clic derecho → Abrir → Abrir**, o ve a **Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos**.<br>
  *If it says it "can't be opened", **right-click → Open → Open**, or go to **System Settings → Privacy & Security → Open Anyway**.*
- **Windows:** si sale "Windows protegió tu PC", toca **Más información → Ejecutar de todas formas**.<br>
  *If you see "Windows protected your PC", click **More info → Run anyway**.*

Descarga Nuggit solo desde este repo.

*Only download Nuggit from this repo.*

---

## 🖥️ Compatibilidad / Compatibility

| Función / Feature | Mac | Windows | Linux |
|---|:---:|:---:|:---:|
| Tablero, widgets, tareas, notas, Dailies, Recordatorios | ✅ | 🧪 | 🧪 |
| Dip y los Tenders (IA: Gemini, Ollama o tu propio servidor) | ✅ | 🧪 | 🧪 |
| Exportar tus tareas a un `.ics` (para Google Calendar, Outlook…) | ✅ | 🧪 | 🧪 |
| Sincronización en vivo con el **Calendario de Apple** | ✅ | ❌ | ❌ |
| Control de **Spotify** con carátula, canción y playlists | ✅ | ❌ ¹ | ❌ |
| Hablarle a Dip con el **dictado** del sistema y voces de la Mac | ✅ | ❌ | ❌ |
| Voz local con **whisper.cpp** | ✅ | ❌ | ❌ |
| Voz con Gemini o con tu propio servidor | ✅ | 🧪 | 🧪 |

✅ funciona / works · 🧪 debería funcionar, pero no se ha probado / should work, untested · ❌ no disponible / not available

¹ **Planeado / Planned:** en Windows, play / pausa / siguiente con las teclas multimedia (sin carátula ni playlists).

*On Windows, play / pause / next through the media keys (no artwork or playlists).*

**Sobre el calendario / About the calendar:** la sincronización en vivo solo funciona con la app Calendario de la Mac. Google Calendar no puede leerla, así que para Google usa la opción de **exportar `.ics`** (es una copia: si cambias algo en Nuggit, vuelve a exportar).

*Live sync only works with the Mac's Calendar app. Google Calendar can't read it, so for Google use **export `.ics`** (it's a snapshot: if you change something in Nuggit, export again).*

¿Probaste Nuggit en Windows o Linux? Cuéntanos qué funcionó y qué no en [Issues](../../issues). 🙏

*Tried Nuggit on Windows or Linux? Tell us what worked and what didn't in [Issues](../../issues).*

---

## 🤖 La IA / The AI

Dip necesita **una** de estas / Dip needs **one** of these:

- **Gemini** (en internet / online): una API key gratis de [Google AI Studio](https://aistudio.google.com/apikey). Lo que le escribes a Dip se manda a Google. / What you write to Dip is sent to Google.
- **Ollama** (en tu computadora / on your computer): gratis y privado, pero necesita una computadora con buena memoria. / Free and private, but needs a computer with plenty of memory.
- **Tu propio servidor** compatible con la API de OpenAI. / **Your own server** that speaks the OpenAI API.

Sin IA, Nuggit funciona igual, solo que sin Dip. / Without AI, Nuggit still works, just without Dip.

---

## 🔒 Tus datos / Your data

Tus tareas, notas, ajustes y tu API key se guardan **solo en tu computadora**, en la carpeta de datos de la app. Nunca se suben a este repo ni a ningún servidor de Nuggit.

*Your tasks, notes, settings and API key are stored **only on your computer**, in the app's data folder. They are never uploaded to this repo or to any Nuggit server.*

---

## 🛠️ Para desarrolladores / For developers

Necesitas / You need **Node.js 20+** y npm.

```bash
npm install     # la primera vez / first time only
npm run dev     # abre la app en modo desarrollo / opens the app in dev mode
```

Configura la IA copiando `.env.example` a `.env` (nunca subas el `.env`). / Set up the AI by copying `.env.example` to `.env` (never commit `.env`).

```bash
npm run typecheck     # revisa los tipos / type check
npm run lint          # revisa el código / lint
npm run build:mac     # crea la app de Mac en dist/ / build the Mac app
npm run build:win     # crea el instalador de Windows / build the Windows installer
npm run build:linux   # crea la versión de Linux / build for Linux
```

La especificación completa y las fases están en [SPEC.md](SPEC.md), y los cambios en [CHANGELOG.md](CHANGELOG.md).

*The full spec and phases are in [SPEC.md](SPEC.md), and the changes in [CHANGELOG.md](CHANGELOG.md).*

---

## 📄 Licencia / License

[MIT](LICENSE): puedes usar, copiar y modificar el código, siempre que mantengas el aviso de copyright.

*[MIT](LICENSE): you can use, copy and change the code, as long as you keep the copyright notice.*
