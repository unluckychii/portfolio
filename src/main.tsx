import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Figtree for titles, Geist for reading, Geist Mono for labels (Google Fonts, served from the site)
import '@fontsource-variable/figtree'
import '@fontsource-variable/figtree/wght-italic.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './desk/desk.css'
import Desk3D from './desk/Desk3D'
import { SITE } from './desk/site'
import { assetUrl } from './desk/projects'
import { nameLoader } from './desk/loadProgress'
import { startAnalytics } from './desk/analytics'

// the loading screen carries the heading set in the CMS
nameLoader(SITE.heading || SITE.name)

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

// visitor stats, when a GoatCounter code is set in the CMS
if (SITE.goatcounter) startAnalytics(SITE.goatcounter)

// the desk is the whole site: / is the desk, /coffee etc. open an object's page over it
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desk3D />
  </StrictMode>,
)
