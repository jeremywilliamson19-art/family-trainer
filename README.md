# Family Trainer

Private fitness and nutrition PWA for one household. React + TypeScript + Vite, with a Google Apps Script backend with Google Sheets storage, hosted on GitHub Pages.

- `docs/SPEC.md`: what we're building, and in what phases
- `docs/SETUP.md`: one-time accounts and deploy
- `docs/INSTALL.md`: installing on each family member's phone

```bash
npm run dev     # local app
npm test        # backend privacy and push tests
npm run build   # typecheck + production build
```

Layout: `src/` (app, `sw.ts` service worker), `backend/src` (Apps Script API, privacy rules, Web Push), `backend/tests`.
