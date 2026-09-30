# Herbarium

A full-page hero of pressed sheets on a paper desk (React 19 + Vite + GSAP ScrollTrigger + Lenis),
with a git-based CMS (Decap) for editing every sheet and an optional project page behind each one.

```
npm install
npm run dev
```

## Content

- Each sheet is one JSON file in `content/sheets/` (number, photo, Latin and common name,
  pressed date, place, note, tape style, finale flag, and the optional "View more" page).
- Photos live in `public/uploads/`. The current `sheet-XX.webp` files are **placeholders**;
  replace them from the CMS or by overwriting the files.
- Sheets appear in order of their number. The sheet marked **Finale sheet** is the one the
  scroll dives into at the end.
- Turning on **View more** adds a button to the back of that sheet, linking to
  `/sheets/<number>`: title, intro, project facts, an external link, a markdown body and a gallery.

## The desk (`/desk`)

A 3D work desk built with three.js: a monitor, a coffee cup, a stack of books, a pigeon, a lamp
and a plant, all modelled in code (no model files). Drag to look around, hover an object to see
its name, click it to fly the camera in and open its page (`/desk/monitor`, `/desk/coffee`,
`/desk/books`, `/desk/pigeon`). The lamp switches on and off. The list along the bottom opens the
same pages from the keyboard or on touch screens.

- Page text lives in `content/desk/*.json` and is edited in the CMS under **Desk objects**.
- The scene is in `src/desk/DeskScene.ts`; the page panel and routing in `src/desk/Desk3D.tsx`.
- three.js only loads on `/desk`, so the herbarium at `/` stays as light as before.

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
   already sets the build command, the output folder and the `/sheets/*` route.
2. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   Homepage URL: your Netlify URL. Callback URL: `https://api.netlify.com/auth/done`.
3. In Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**
   and paste the client ID and secret from step 2.
4. Go to `https://<your-site>/admin`, log in with GitHub (needs write access to the repo),
   and edit.

The CMS settings are in `public/admin/config.yml` (repo, branch, fields).
