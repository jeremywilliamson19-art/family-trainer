# How it's hosted

No paid services and no extra accounts: GitHub and Jeremy's Google account only.

| Piece | Where |
|---|---|
| App (static PWA) | GitHub Pages: https://jeremywilliamson19-art.github.io/family-trainer/ |
| Server logic | Google Apps Script project **Family Trainer** (`backend/src`, bundled to `backend/dist/Code.js`) |
| Data | Google Sheet **Family Trainer Data** in Jeremy's Drive (one tab per table; created by `setup()`) |
| Sign-in codes | Emailed from Jeremy's Gmail by Apps Script (100 a day) |
| Push notifications | Sent by Apps Script itself (pure-JS Web Push; VAPID keys live in Script Properties) |

Secrets live only in **Apps Script → Project Settings → Script Properties**: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `ADMIN_EMAIL` and `SHEET_ID`, all created by `setup()`. Nothing secret is in this repo, which is why it can be public.

## Updating

```bash
npm run backend:deploy   # build, upload, publish a new version (same URL)
npm run deploy:web       # test, build, publish the app to the gh-pages branch
```

`backend/deployment.json` holds the web-app deployment id, so the `/exec` URL never changes; deploy-web.sh builds the app with it.

## One-time setup (already done)

1. `npx clasp login` in Terminal, approving all permissions. Turn on the Apps Script API at https://script.google.com/home/usersettings.
2. `npx clasp create --type standalone --title "Family Trainer" --rootDir backend/dist`, then `npm run backend:push`.
3. In the Apps Script editor, run **setup** once and approve the permissions. Because this is your own script, Google shows "unverified app": click **Advanced → Go to Family Trainer**.
4. `npm run backend:deploy`, then `npm run deploy:web`.
5. Repo Settings → Pages → Source: **Deploy from a branch → gh-pages / (root)**.

## Local development

```bash
npm run dev:api                                           # real handlers, in-memory data; codes print here
VITE_API_URL=http://localhost:8787 BASE_PATH=/ npm run dev
npm test        # privacy rules, macro math, food search, offline queue, push crypto, Apps Script bundle
```

The generic food list (`public/foods/usda.json`) is built from USDA's public-domain SR Legacy download with `node scripts/build-usda.mjs <csv folder>`. Everyday foods with friendly names are in `src/lib/commonFoods.ts`.

**Jeremy must be the first to sign in.** Only `ADMIN_EMAIL`, invited emails, and existing members can receive a code.
