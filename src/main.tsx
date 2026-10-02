import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import './desk/desk.css'
import Desk3D from './desk/Desk3D'

// the desk is the whole site: / is the desk, /coffee etc. open an object's page over it
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desk3D />
  </StrictMode>,
)
