import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DetachedWidget } from './desktop/DetachedWidget'
import { DipPopover } from './popover/DipPopover'

// Every window loads this same page: a detached widget with ?widget=<id>, Dip's menu bar
// mini chat with ?view=popover, and the main window with nothing.
const params = new URLSearchParams(window.location.search)
const detachedId = params.get('widget')
const view = params.get('view')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {view === 'popover' ? (
      <DipPopover />
    ) : detachedId ? (
      <DetachedWidget id={detachedId} />
    ) : (
      <App />
    )}
  </StrictMode>
)
