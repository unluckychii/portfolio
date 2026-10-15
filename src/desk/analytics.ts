/**
 * Visitor stats with GoatCounter (goatcounter.com): no cookies and nothing personal kept, so no
 * consent banner is needed. Its code (the part before .goatcounter.com) is set in the CMS under
 * Site settings; with none, nothing loads. Its script counts the page a visitor lands on; moving
 * between the desk's pages changes the address without a page load, so those are counted here.
 */

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string }) => void }
  }
}

let last = ''

export function startAnalytics(code: string) {
  // previews (built to run from any folder) aren't the site, so they aren't counted
  if (import.meta.env.BASE_URL === './' || !/^[a-z0-9-]+$/i.test(code)) return
  last = location.pathname
  const add = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://gc.zgo.at/count.js'
    s.dataset.goatcounter = `https://${code.toLowerCase()}.goatcounter.com/count`
    document.body.appendChild(s)
  }
  // after the page and the desk's files have had their turn
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(add, { timeout: 4000 }) : setTimeout(add, 1500))
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}

/** count a page the visitor moved to within the site */
export function countPage() {
  const path = location.pathname
  if (path === last) return
  last = path
  window.goatcounter?.count?.({ path })
}
