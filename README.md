# Oversight Supply — the desk

A 3D work desk built with three.js (React 19 + Vite): a monitor, a coffee cup, a stack of books,
a pigeon, a lamp and a plant, all modelled in code (no model files). Drag to look around, hover an
object to see its name, click it to fly the camera in and open its page (`/monitor`, `/coffee`,
`/books`, `/pigeon`). The lamp switches on and off. The list along the bottom opens the same pages
from the keyboard or on touch screens.

```
npm install
npm run dev
```

## Content

- Each object's page is one JSON file in `content/desk/` (name on hover, hint, title, intro,
  a markdown body and links). Edit them in the CMS under **Desk objects**, or by hand.
- The scene is in `src/desk/DeskScene.ts`; the page panel and routing in `src/desk/Desk3D.tsx`.
- Uploaded images go to `public/uploads/`.

## Editing with the CMS

The editor is at **`/admin`**. Saves are committed to the `main` branch, which rebuilds the site.

### Local editing (no login)

```
npx decap-server      # terminal 1
npm run dev           # terminal 2
```
Open http://localhost:5173/admin/index.html. Changes are written straight to the files here.

### Online editing on Netlify (one-time setup)

1. Merge this work into `main` and create a Netlify site from the repo. `netlify.toml`
   already sets the build command, the output folder and the object page routes.
2. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   Homepage URL: your Netlify URL. Callback URL: `https://api.netlify.com/auth/done`.
3. In Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**
   and paste the client ID and secret from step 2.
4. Go to `https://<your-site>/admin`, log in with GitHub (needs write access to the repo),
   and edit.

The CMS settings are in `public/admin/config.yml` (repo, branch, fields).
