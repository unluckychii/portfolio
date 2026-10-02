# Aaron's Desk

A 3D work desk built with three.js (React 19 + Vite): a laptop, a coffee cup, a stack of books,
a pigeon, a salt lamp and a plant, with a painting on the wall. Drag to look around, hover an
object to see its name, click it to fly the camera in and open its page (`/laptop`, `/coffee`,
`/books`, `/pigeon`). The salt lamp switches on and off. The list along the bottom opens the same pages
from the keyboard or on touch screens.

```
npm install
npm run dev
```

## Content

- Each object's page is one JSON file in `content/desk/` (name on hover, hint, title, intro,
  a markdown body and links). Edit them in the CMS under **Desk objects**, or by hand.
- Clicking the books opens the Projects page as a shelf of book covers (styled after
  press.stripe.com); each book opens a case study at `/books/<address>`. Each project is one JSON
  file in `content/projects/` (title, subtitle, cover, spine, year, client, role, intro, write-up,
  images, link). Edit them in the CMS under **Projects**, where you can also add new ones; covers
  and images upload to `public/uploads/books/`. The four starting covers and spines were rendered
  from the 3D books.
- The site name ("Aaron's Desk") and the interface text around the desk (header, hints, the back
  and next labels, the lamp's name tag, the credits button) are in `content/site.json`. Edit them
  in the CMS under **Site settings**, or by hand. Anything left out falls back to a default.
- The scene is in `src/desk/DeskScene.ts`; the page panel and routing in `src/desk/Desk3D.tsx`.
- Uploaded images go to `public/uploads/`.
- The painting on the wall is Caravaggio's *Narcissus* (c. 1597–99, public domain), in
  `public/art/narcissus.webp`. To hang something else, replace that file and update the image size
  next to `PAINTING` in `src/desk/DeskScene.ts` so it isn't stretched.
- The laptop is a 3D model, `public/models/laptop.glb`: "MacBook Air M2" by rtql8d on Sketchfab,
  CC BY 4.0. The licence requires the credit line shown in the corner of the page; keep it if the
  model stays. Its wallpaper was removed (the site draws its own screen) and its textures converted
  to WebP. If the file can't load, the desk shows a built-in monitor and keyboard instead.
- The coffee cup is a 3D model, `public/models/coffee.glb`: "Coffee Cup" by Lasse Harm
  (GreenLineStudio) on Sketchfab, CC BY 4.0, also credited in the corner of the page. If it can't
  load, the desk shows a built-in mug instead.
- The lamp is a 3D model, `public/models/lamp.glb`: "Salt Rock Lamp (Game Ready / 2K PBR)" by
  Meerschaum Digital on Sketchfab, CC BY 4.0, credited in the corner of the page. Its textures
  were resized to 1K and converted to WebP. Clicking it switches its glow and its warm light on
  and off. If it can't load, the desk shows a built-in desk lamp instead.
- The plant is a 3D model, `public/models/plant.glb`: "Assignment 8: Plant" by Teague McGinn on
  Sketchfab, CC BY 4.0, credited in the corner of the page. Its textures were resized to 512px and
  converted to WebP. If it can't load, the desk shows a built-in plant instead.
- The books are a 3D model, `public/models/books.glb` (four upright books with custom covers;
  textures resized to 1024px so the cover text stays readable, as WebP). The desk scales and centres the model to fit,
  so a replacement `.glb` just needs to stand upright. They come from a Sketchfab model whose
  source and licence still need recording (and a credit line, if it is CC BY).
- The pigeon is a 3D model, `public/models/pigeon.glb` (rigged, with its own idle animation). To swap
  it, replace that file with another `.glb`, then adjust `PIGEON_SCALE` in `src/desk/DeskScene.ts`
  if the size is off. If the file is missing or fails to load, the desk shows its built-in pigeon.

## Editing with the CMS

The editor is at **`/admin`** (https://unluckychii.github.io/portfolio/admin/), with two sections:

- **Desk objects**: the page behind each object (title, intro, body, links) and its name tag.
- **Projects**: the case studies on the book shelf, with their covers and images.
- **Site settings**: the site name and the interface labels.

It runs [Sveltia CMS](https://github.com/sveltia/sveltia-cms), a drop-in replacement for Decap CMS
that reads the same `public/admin/config.yml`.

### Online: sign in with an access token (one-time setup)

1. On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token** (https://github.com/settings/personal-access-tokens/new).
2. Name it (e.g. "Desk CMS"), pick an expiry, and under **Repository access** choose **Only select
   repositories → unluckychii/portfolio**.
3. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**.
4. Generate it and copy the token.
5. Open `/admin` on the live site, choose **Sign In Using Access Token** and paste it. The browser
   remembers it until you sign out.

Each save is a commit to `main`; the GitHub Pages workflow then republishes the site, usually
within two minutes. When the token expires, generate a new one the same way.

### Locally: edit the files on this computer

With `npm run dev` running, open http://localhost:5173/admin/index.html in **Chrome or Edge**,
choose **Work with Local Repository** and select the `portfolio` folder. Saves are written straight
to the files in `content/`; reload the desk to see them, then commit and push to publish.
(Safari and Firefox can't open local folders; use the online editor there.)

## Publishing (GitHub Pages)

The live site is https://unluckychii.github.io/portfolio/. `.github/workflows/pages.yml` builds it
and publishes it on every push to `main`, including CMS saves, usually within two minutes. The
progress is under the repo's **Actions** tab.

One-time settings on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** (With "Deploy from a
   branch", Pages publishes the unbuilt source files and the site shows nothing.)
2. **Settings → General → Default branch: `main`**, so the CMS, the workflow and the site all
   use the same branch.

The site is built with the `/portfolio/` prefix there (`BASE_PATH` in the workflow); locally and
on Netlify it lives at `/`.

The CMS settings are in `public/admin/config.yml` (repo, branch, fields).
