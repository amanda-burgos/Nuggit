import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DetachedWidget } from './desktop/DetachedWidget'
import { QuickPickup } from './pickup/QuickPickup'
import { DipPopover } from './popover/DipPopover'
import { MusicPopover } from './popover/MusicPopover'
import { AppearanceRoot } from './theme/AppearanceRoot'

// Every window loads this same page: a detached widget with ?widget=<id>, Dip's menu bar
// mini chat with ?view=popover, the quick pickup with ?view=pickup, the music mini player
// with ?view=music, and the main window with nothing.
const params = new URLSearchParams(window.location.search)
const detachedId = params.get('widget')
const view = params.get('view')

// A detached widget's window is transparent; its page draws the rounded card.
if (detachedId) document.documentElement.classList.add('is-detached-window')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppearanceRoot>
      {view === 'popover' ? (
        <DipPopover />
      ) : view === 'pickup' ? (
        <QuickPickup />
      ) : view === 'music' ? (
        <MusicPopover />
      ) : detachedId ? (
        <DetachedWidget id={detachedId} />
      ) : (
        <App />
      )}
    </AppearanceRoot>
  </StrictMode>
)
