import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/500.css'
import './desk/desk.css'
import Desk3D from './desk/Desk3D'
import { SITE } from './desk/site'
import { assetUrl } from './desk/projects'

// the tab icon set in the CMS (index.html carries the default until this runs)
if (SITE.favicon) {
  for (const rel of ['icon', 'apple-touch-icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }
    link.href = assetUrl(SITE.favicon)
  }
}

// the desk is the whole site: / is the desk, /coffee etc. open an object's page over it
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desk3D />
  </StrictMode>,
)
