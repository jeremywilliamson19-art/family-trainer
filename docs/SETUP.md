# One-time setup (accounts and deploy)

Everything here is free tier. It takes about 30 minutes. You sign in to each service yourself; Claude Code can run the commands once you're signed in.

Commands below run from the `family-trainer` folder in Terminal. Node is installed in `~/.local/node` (open a new Terminal window if `npx` isn't found).

## 1. GitHub repo

1. Create a **private** repo at github.com/new called `family-trainer`. Leave it empty.
2. Push this folder:
   ```bash
   git remote add origin https://github.com/YOUR-USER/family-trainer.git
   git push -u origin main
   ```

## 2. Supabase project

1. Sign up at supabase.com and create a project named `family-trainer`. Pick the US West region. Save the database password in your password manager.
2. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
3. Link and push the database schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```

### Auth settings (dashboard)

**Authentication → Sign In / Providers → Email**
- Email provider: on
- Confirm email: **off** (the 6-digit code already proves the email)
- Email OTP length: **6**, expiry **900** seconds

**Authentication → Email Templates**: In both **Magic Link** and **Confirm signup**, set:
- Subject: `Your Family Trainer code: {{ .Token }}`
- Body: paste the contents of `supabase/templates/code.html`

The template must show `{{ .Token }}`, not a link. On iPhone, a link opens Safari instead of the home-screen app.

**Authentication → URL Configuration**: Set Site URL to your Vercel address (step 4).

### Email sending (needed for Amanda)

Supabase's built-in sender only delivers to members of your Supabase team, and only a few emails an hour. To send Amanda her codes, use Gmail's SMTP server for free:

1. Your Google account needs 2-Step Verification on. Create an **App password** at myaccount.google.com/apppasswords.
2. **Authentication → Emails → SMTP Settings** → Enable custom SMTP:
   - Host `smtp.gmail.com`, port `465`
   - Username: your Gmail address. Password: the app password.
   - Sender email: your Gmail address. Sender name: `Family Trainer`.

## 3. Push notification keys and edge functions

```bash
npx web-push generate-vapid-keys
```

This prints a public key and a private key. Keep the private key secret: put it only in Supabase secrets, never in the app or in git.

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@gmail.com
npx supabase functions deploy --use-api
```

## 4. Vercel

1. Sign up at vercel.com with GitHub. Click **Add New → Project** and import `family-trainer`. Vercel detects Vite automatically.
2. Environment variables:
   - `VITE_SUPABASE_URL`: the Project URL from step 2
   - `VITE_SUPABASE_ANON_KEY`: the anon / publishable key
   - `VITE_VAPID_PUBLIC_KEY`: the **public** key from step 3
3. Deploy. Copy the `https://….vercel.app` address and:
   - Put it in Supabase → Authentication → URL Configuration → Site URL
   - Replace `[APP URL]` in `docs/INSTALL.md`

Each push to `main` redeploys automatically.

## 5. First sign-in

**Jeremy must be the first person to sign in.** The first account ever created becomes the household admin; everyone after that needs an invite. Then follow `docs/INSTALL.md`.

## Local development

```bash
cp .env.example .env.local   # fill in the same three values
npm run dev                  # http://localhost:5173 (also on your Wi-Fi IP)
npm test                     # database RLS tests (runs in PGlite, no Docker)
```

Push notifications and the camera need HTTPS on a real iPhone, so test those on the Vercel deploy.
