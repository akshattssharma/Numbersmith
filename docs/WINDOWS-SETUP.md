# Numbersmith on Windows — no Command Prompt

You don't need Node, npm, or a terminal on your PC. **GitHub builds the site for you**
on their servers. Your machine only has to move files.

Two paths below. Do **Path A**. Path B is only if you also want it running locally.

---

## Path A — publish it (about 10 minutes, all clicking)

### 1. Unzip

Right-click `numbersmith.zip` → **Extract All…** → put it somewhere short and simple like
`C:\Users\<you>\Documents\numbersmith`.

Avoid Desktop or OneDrive-synced folders — OneDrive sometimes locks files mid-sync and
GitHub Desktop then reports changes it can't commit.

You should end up with a folder containing `README.md`, `package.json`, and a `src` folder.
There's also a hidden `.git` folder — that's the project history, already set up. Don't
delete it.

### 2. Install GitHub Desktop

Download from **desktop.github.com** → run the installer → sign in with your GitHub
account (or create one, it's free).

This is the only software you need to install.

### 3. Add the folder

In GitHub Desktop: **File → Add local repository…** → **Choose…** → select your
`numbersmith` folder → **Add repository**.

It will recognise it immediately and show 5 commits of history. If it says *"this
directory does not appear to be a Git repository"*, you've selected one level too high or
too low — pick the folder that directly contains `package.json`.

### 4. Publish it

Click **Publish repository** (top bar).

- Name: `numbersmith`
- **Untick "Keep this code private."** ← this matters. GitHub Pages is only free on public
  repos, and a portfolio piece nobody can open isn't a portfolio piece.
- Click **Publish repository**.

### 5. Turn on Pages

Click **View on GitHub** in GitHub Desktop to open the repo in your browser, then:

**Settings** (top tabs) → **Pages** (left sidebar) → under *Build and deployment*, set
**Source** to **GitHub Actions**.

That's the only setting you change. Don't pick "Deploy from a branch."

### 6. Watch it build

Click the **Actions** tab. You'll see a run called *"test and deploy"* with a spinning
amber dot. It takes about two minutes:

- it type-checks the project
- it runs all 56 tests
- it builds the site
- it publishes

When the dot turns green, your site is live at:

```
https://<your-username>.github.io/numbersmith/
```

If a test ever fails, the build stops and your live site keeps the last working version.
That's deliberate.

### 7. Put the link in the README

Open `README.md` in Notepad (right-click → Open with → Notepad). Line 10 says:

```
**[Live demo →](#)** *(add your GitHub Pages URL after the first deploy)*
```

Replace the `#` with your real URL, save, then in GitHub Desktop: type a summary like
`Add live demo link`, click **Commit to main**, then **Push origin**.

For a portfolio piece, someone who can't reach the demo in one click won't reach it at all.

---

## Path B — also run it on your own PC (optional)

Only if you want to change things and see them instantly. Skip if you just want it online.

### 1. Install Node.js

**nodejs.org** → the big green **LTS** button → run the `.msi` → Next, Next, Finish.
Accept the defaults. Restart your PC afterwards.

### 2. Install VS Code

**code.visualstudio.com** → download → install → open it.

### 3. Open the project

**File → Open Folder…** → your `numbersmith` folder.

### 4. Run it by clicking

In the left **Explorer** sidebar, scroll to the very bottom for a collapsed section
called **NPM SCRIPTS**. Click to expand it. (If it isn't there: click the `…` at the top
of the Explorer panel and tick *NPM Scripts*.)

You'll see `dev`, `build`, `test`, `sim`. Hover over one and click the **▶ play** button.

- **dev** — runs the game. Ctrl-click the `http://localhost:5173` link that appears.
- **test** — runs all 56 tests.
- **sim** — prints the five-children divergence report.

The first time you click any of them, it will need the dependencies installed. Hover over
**NPM SCRIPTS**, click the `…`, and choose **Run Install** — that's `npm install` without
typing it. It takes a couple of minutes once.

**Honest caveat:** VS Code shows a terminal *panel* at the bottom to display output. You
never type into it — you're clicking play buttons — but if "no command prompt" meant "no
black window anywhere," stick to Path A, which involves none at all.

---

## Path C — try it in a browser, install nothing

Once Path A is done, you can open the project in a full editor that runs in your browser,
with no install at all:

```
https://stackblitz.com/github/<your-username>/numbersmith
```

It fetches your repo, installs everything in the browser tab, and runs it. Useful for
showing someone the code without them setting anything up. Free, no account needed to look.

---

## If something goes wrong

**GitHub Desktop says "does not appear to be a Git repository."**
You picked the wrong folder level. Pick the folder that directly contains `package.json`.
If you extracted the zip twice you may have `numbersmith\numbersmith` — go one deeper.

**The Actions tab is empty and nothing builds.**
Check **Settings → Pages → Source** is set to **GitHub Actions**, not "Deploy from a
branch." If it's already right, go to **Actions**, click *"test and deploy"* on the left,
then **Run workflow** to start one by hand.

**The site loads but is a blank page or has no styling.**
Almost always because the repo was renamed after the first deploy. The build derives the
URL path from the repo name, so just push any small change (edit the README, commit,
push) and it will rebuild correctly.

**The build fails on a red X.**
Click the failed run → click the failed step → read the last few red lines. Copy them to
me and I'll tell you what it is. Your live site is unaffected until a build passes.

**Windows blocks the installers.**
Both GitHub Desktop and Node.js are signed and mainstream. If SmartScreen warns, click
*More info → Run anyway*. If your machine is work-managed you may need IT — in that case
Path A still works entirely in a browser if you upload the files through
**github.com → Add file → Upload files** instead of using GitHub Desktop.

---

## What you should end up with

- A public repo at `github.com/<you>/numbersmith` — the code, 56 tests, the full write-up
- A live site at `<you>.github.io/numbersmith/` — playable, no login
- Automatic redeploys: change anything, commit in GitHub Desktop, push, and it rebuilds

No Node on your machine, no terminal, no cost.
