import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import './herbarium.css'
import HerbariumHero from './HerbariumHero'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HerbariumHero />
  </StrictMode>,
)
