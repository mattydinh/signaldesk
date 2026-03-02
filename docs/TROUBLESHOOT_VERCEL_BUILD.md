# Troubleshooting Vercel "Internal Error" on Build

When the build fails with **"We encountered an internal error. Please try again"**, Vercel often hides the real cause. Use these steps to get the actual error.

## 1. Get the real build log

1. In Vercel: **Project → Deployments**
2. Click the **failed** deployment (red X).
3. Click **"Building"** (or the failed step) to expand it.
4. Scroll through the full log. The real error often appears **above** the generic "internal error" message—look for:
   - `Error:`
   - `Failed to compile`
   - `prisma: command not found`
   - `Module not found`
   - `FATAL:` or stack traces
5. Copy the **last 50–100 lines** of the build log (including any error block) and share them so we can fix the root cause.

## 2. Try redeploy with cleared cache

- **Redeploy** → leave **"Use existing Build Cache"** **unchecked** → **Redeploy**.

## 3. Confirm environment variables at build time

- **Settings → Environment Variables**
- Ensure **Production** (and Preview if you use it) has:
  - `POSTGRES_PRISMA_URL` (or whatever your Prisma schema uses)
- Variables are available during **Build** by default; if you changed that, re-enable for Build.

## 4. Bisect: see if the failure is from recent code

- In GitHub, open **Commits** and note the last commit that **succeeded** on Vercel.
- Create a branch from that commit:  
  `git checkout -b bisect <last-good-commit-hash>`
- Push and let Vercel deploy that branch.  
  - If that deploy **succeeds**, the failure is in commits after the last good one.  
  - If it **fails**, the issue is likely env, Vercel config, or account/project.

## 5. Vercel support

If the build log shows no clear error and redeploy + cache clear doesn’t help, contact **Vercel support** with:

- Project name and the failed deployment URL
- “Build fails with generic ‘internal error’; need the underlying build error or logs.”
- Ask them to check **build logs** and **builder errors** on their side.
