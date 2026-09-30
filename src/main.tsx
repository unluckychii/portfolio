import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import './herbarium.css'
import './project.css'
import HerbariumHero from './HerbariumHero'
import ProjectPage from './ProjectPage'

// three.js only loads on the desk
const Desk3D = lazy(async () => {
  await import('./desk/desk3d.css')
  return import('./desk/Desk3D')
})

// /sheets/07 → that sheet's project page; /desk(/coffee) → the 3D desk; everything else → the herbarium
const path = window.location.pathname
const sheet = path.match(/^\/sheets\/([^/]+)\/?$/)
const desk = /^\/desk(\/[^/]*)?\/?$/.test(path)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {desk ? (
      <Suspense fallback={null}>
        <Desk3D />
      </Suspense>
    ) : sheet ? (
      <ProjectPage no={decodeURIComponent(sheet[1])} />
    ) : (
      <HerbariumHero />
    )}
  </StrictMode>,
)
