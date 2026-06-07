# BeadRev NG

A boutique storefront for handmade Yorùbá-themed beaded jewellery — bracelets and
necklaces named after Yorùbá words and the meanings/intentions behind them.

The site is plain HTML/CSS/JS (no build step, no framework). The catalogue lives
in a small JSON store (JSONBin) and photos live on Cloudinary; the founder edits
both — live, with no redeploy — through a private `/admin.html` page guarded by
a password. A single Netlify Function is the only thing that ever sees the
JSONBin master key and the admin password, so no secret reaches the browser.

```
storefront  → index.html + css/styles.css + js/app.js + js/config.js + data/seed.js
admin       → admin.html + js/admin.js   (private, unlinked, noindex)
backend     → netlify/functions/products.js  (the only place secrets live)
```

## How data flows

1. The storefront asks the Netlify Function for the catalogue
   (`/.netlify/functions/products`).
2. The Function fetches the catalogue from JSONBin using a master key that is
   stored only as a Netlify environment variable, and hands the JSON back to
   the browser.
3. The storefront caches what it gets in `localStorage` and renders instantly
   from that cache on the next visit, refreshing quietly in the background. If
   both the cache and the network are unavailable, it falls back to the
   placeholder catalogue in `data/seed.js` so the shop is never blank.
4. In the admin page, the founder signs in with a password (kept in memory for
   that browser tab only — never saved to disk), edits products, uploads
   photos straight to Cloudinary, and presses **Save catalogue to BeadRev**.
   That POSTs the whole catalogue plus the password to the same Function, which
   checks the password against `ADMIN_PASSWORD` server-side and only then
   writes the new catalogue to JSONBin.

---

## 1. Prerequisites — accounts you'll need

You'll need free accounts with three services:

- **[GitHub](https://github.com)** — to host the project's source code
- **[Netlify](https://netlify.com)** — to deploy the site and run the Function
- **[JSONBin](https://jsonbin.io)** — to store the product catalogue as JSON
- **[Cloudinary](https://cloudinary.com)** — to host and transform product photos

### Set up JSONBin

1. Sign in to JSONBin and open **API Keys** in your account settings. Copy your
   **Master Key** — you'll add it to Netlify in step 3 (never put it in any file
   that gets committed to GitHub).
2. Create a new bin containing:
   ```json
   { "products": [], "updatedAt": "" }
   ```
3. Copy the **Bin ID** from the URL or bin details. The bin used while building
   this project was `6a25306ada38895dfe940904` — replace it with your own bin's ID.

### Set up Cloudinary

1. From your Cloudinary dashboard, copy your **Cloud name**.
2. Go to **Settings → Upload → Upload presets**, add a new preset, set
   **Signing Mode** to **Unsigned**, and give it a short name (this project
   uses `beadrev`). Unsigned presets let the admin page upload photos directly
   from the browser without exposing your API secret.

### Pick an admin password

Choose a password only the founder will use to sign in to `/admin.html`. You'll
store it as a Netlify environment variable in step 3 — it never lives in the
codebase.

---

## 2. Configure the non-secret settings

Open [js/config.js](js/config.js) and fill in the values for **your** accounts
(these are all safe to commit — none of them are secrets):

```js
window.BEADREV_CONFIG = {
  cloudName:      "your-cloudinary-cloud-name",
  uploadPreset:   "your-unsigned-upload-preset-name",
  whatsappNumber: "234XXXXXXXXXX",        // WhatsApp number for checkout, no + or spaces
  instagramUrl:   "https://www.instagram.com/your-handle/",
  apiPath:        "/.netlify/functions/products"
};
```

Leave `apiPath` as-is — it points at the Function that Netlify deploys for you.

---

## 3. Deploy: GitHub repo connected to Netlify

> **Important:** deploy by connecting a GitHub repository to Netlify — **not**
> by dragging a folder onto Netlify's deploy area. Drag-and-drop deploys can't
> run Netlify Functions, and the Function is what keeps your JSONBin key and
> admin password off the browser. A GitHub-connected deploy is the only path
> that runs `netlify/functions/products.js`.

1. **Push this project to a new GitHub repository.**
   ```bash
   git init
   git add .
   git commit -m "BeadRev NG storefront and admin"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Connect the repo to Netlify.**
   - In the Netlify dashboard, choose **Add new site → Import an existing
     project**, then **Deploy with GitHub** and select your new repository.
   - Netlify will read [netlify.toml](netlify.toml) automatically — it already
     points the publish directory at the project root and tells Netlify where
     to find the Function (`netlify/functions`). You don't need to set a build
     command.

3. **Add the three secrets as environment variables.**
   In your new site's dashboard, go to **Site configuration → Environment
   variables** and add:

   | Key                 | Value                                             |
   |---------------------|---------------------------------------------------|
   | `JSONBIN_MASTER_KEY`| your JSONBin master key                           |
   | `JSONBIN_BIN_ID`    | your JSONBin bin ID                               |
   | `ADMIN_PASSWORD`    | the password you chose for `/admin.html`          |

   These three values are the *only* secrets BeadRev has, and the Function
   (`netlify/functions/products.js`) is the only code that reads them.

4. **Deploy.** Trigger a deploy (Netlify does this automatically after you
   connect the repo, and again on every push to `main`). Once it finishes,
   open the site URL Netlify gives you — the shop should load with the
   placeholder catalogue from `data/seed.js` until you add real products.

---

## 4. Add your first product through the admin page

1. Visit `https://<your-site>.netlify.app/admin.html`.
2. Enter the password you set as `ADMIN_PASSWORD` and select **Enter**.
3. Select **+ Add a new piece**. Fill in:
   - **Yorùbá name**, **Meaning**, **Type** (bracelet/necklace), **Tagline**,
     and an optional **Material description**.
   - **Price (₦)** and whether it's **In stock**.
   - **Themes**, **Colours**, and **Sizes** — type each one and press Enter to
     add it as a chip; select the ✕ on a chip to remove it. Themes drive the
     filter chips on the shop page (e.g. Success, Joy, Love, Favour, Faith,
     Protection).
   - **Photo** — drag an image onto the drop area, or select it to choose a
     file. It uploads straight to Cloudinary; you'll see a preview once it's done.
4. Select **Save piece**. It's added to the working list (saved locally in your
   browser as a draft) — but it isn't live yet.
5. Reorder pieces with the **↑ / ↓** buttons on each card if you'd like to
   change the order they appear in the shop.
6. When you're happy with the catalogue, select **Save catalogue to BeadRev**
   at the bottom of the page. This sends your changes — together with your
   password — to the Function, which verifies the password and writes the
   catalogue to JSONBin. Once you see "Saved just now — it's live on the shop",
   refresh the storefront to see your product.

If a save fails (wrong password, or a network hiccup), the admin page tells you
what happened and keeps your draft safely on your device so nothing is lost —
just try again.

---

## Local preview

Because the storefront uses relative paths, you can open [index.html](index.html)
directly in a browser to preview layout and styling. The catalogue will load
from `data/seed.js` (no Function available locally), and the admin page won't be
able to save — both are expected without a Netlify dev environment. To test the
full flow including the Function, install the Netlify CLI and run:

```bash
npm install -g netlify-cli
netlify dev
```
