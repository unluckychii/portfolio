import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import './herbarium.css'
import './project.css'
import HerbariumHero from './HerbariumHero'
import ProjectPage from './ProjectPage'

// /sheets/07 → that sheet's project page; everything else → the desk
const sheet = window.location.pathname.match(/^\/sheets\/([^/]+)\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sheet ? <ProjectPage no={decodeURIComponent(sheet[1])} /> : <HerbariumHero />}
  </StrictMode>,
)
