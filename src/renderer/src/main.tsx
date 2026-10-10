import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DetachedWidget } from './desktop/DetachedWidget'

// A detached widget window loads this same page with ?widget=<id>.
const detachedId = new URLSearchParams(window.location.search).get('widget')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{detachedId ? <DetachedWidget id={detachedId} /> : <App />}</StrictMode>
)
