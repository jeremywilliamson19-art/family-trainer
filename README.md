# Family Trainer

Private fitness and nutrition PWA for one household. React + TypeScript + Vite, with Supabase (auth, Postgres with RLS, edge functions) and Vercel.

- `docs/SPEC.md`: what we're building, and in what phases
- `docs/SETUP.md`: one-time accounts and deploy
- `docs/INSTALL.md`: installing on each family member's phone

```bash
npm run dev     # local app
npm test        # RLS tests against the real migrations (PGlite)
npm run build   # typecheck + production build
```

Layout: `src/` (app, `sw.ts` service worker), `supabase/migrations` (schema and RLS), `supabase/functions` (edge functions), `supabase/tests`.
