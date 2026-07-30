# Dynasty Command Center

A live dashboard for Sleeper dynasty fantasy football leagues. Anyone who visits
the site can type in their own Sleeper username and get:

- Their own roster (starters, bench, taxi squad, IR)
- Full league standings, with the ability to browse any other team's roster
- A free agent browser, filterable by position
- Draft pick trade history (acquired / traded away)
- League-wide trending waiver adds
- An AI-generated scouting report: start/sit calls, waiver targets, **specific
  trade proposals naming real league-mates by name**, and draft targets — all
  grounded in live news and rankings via web search

No installs needed for your friends — they just visit the website you publish
and type their username in.

---

## What you need before you start

1. **A free GitHub account** — github.com (this is just a place to store the code)
2. **A free Vercel account** — vercel.com (this is what actually runs the website;
   sign up using your GitHub account so they connect automatically)
3. **An Anthropic API key** — console.anthropic.com
   - Sign up, add a payment method (this is separate from a normal Claude.ai
     subscription — it's pay-as-you-go, billed by usage)
   - Go to "API Keys" and create one, starts with `sk-ant-...`
   - Keep this private. Never share it or put it directly in your code.

---

## Step 1: Put this code on GitHub

1. Go to github.com and click the **+** icon → **New repository**
2. Name it something like `dynasty-command-center`, keep it Public or Private
   (either works), click **Create repository**
3. On the new repository page, click **uploading an existing file**
4. Drag this entire folder's contents into the upload box (everything except
   `node_modules`, which doesn't exist yet — you won't have that folder)
5. Click **Commit changes**

## Step 2: Deploy it on Vercel

1. Go to vercel.com and sign in with GitHub
2. Click **Add New... → Project**
3. Find and select the `dynasty-command-center` repository, click **Import**
4. Vercel will detect it's a Next.js project automatically — you don't need to
   change any build settings
5. Before clicking Deploy, open **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (paste your key from console.anthropic.com)
6. Click **Deploy**

After a minute or two, Vercel gives you a live URL like
`dynasty-command-center-yourname.vercel.app` — that's the link you share with
your friends.

---

## Updating it later

Whenever you want to change anything, edit the files and re-upload them to the
same GitHub repository (GitHub's web interface lets you edit files directly, or
re-upload changed ones). Vercel automatically redeploys the site every time the
GitHub repository changes — no extra steps needed.

## Keeping costs low

- Each AI scouting report costs roughly 3-6 cents (Claude usage + a small web
  search fee), billed to whatever card you added on console.anthropic.com
- You can watch your spending anytime at console.anthropic.com under "Usage"
- If you ever want to pause the AI feature without taking the whole site down,
  just remove the `ANTHROPIC_API_KEY` environment variable in Vercel — the rest
  of the dashboard (rosters, trades, trends) keeps working since that's all
  free, live Sleeper data
