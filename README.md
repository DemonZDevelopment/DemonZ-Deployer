# DemonZ Deployer v3.0.0 — Command Center

<p align="center">
  <img src="assets/banner.png" alt="DemonZ Deployer Banner" style="border-radius: 12px; max-width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" />
</p>

> **Serverless GitHub deployment command center for mobile-first developers.**
> Upload workspace artifacts — folders, files, or ZIP archives — and let GitHub Actions handle the synchronisation. No backend server. No secrets in the browser. Works from any device.

---

## ✨ What's New in v3.0.0

| Feature | Description |
|:---|:---|
| **Deployment History** | Persistent local history of all deployments with Actions status badges |
| **Live Actions Monitoring** | Real-time polling of GitHub Actions pipeline status after deploy |
| **Multi-Format Upload** | Drag-and-drop folders, individual files, or ZIP archives |
| **ZIP Inspector** | Preview file contents, sizes, and workflow files before deploying |
| **Smart Workflow Handling** | `.github/workflows/*.yml` files pushed directly via API (no PAT needed) |
| **Custom Commit Messages** | Set your own commit message per deployment |
| **Deploy Modes** | Choose between Merge (overlay) and Replace (clean sync) |
| **Branch Management** | Create new branches directly from the UI |
| **Repository Dashboard** | Quick stats, recent commits, and direct links to GitHub |
| **Professional Sound Design** | Aternos-style audio feedback (opt-in via settings) |
| **Command Palette** | VS Code-style `Ctrl+K` for quick actions |
| **Pipeline Version Detection** | Auto-detects outdated pipelines with one-click upgrade |
| **Deployment Receipts** | `.deploy-receipt.json` written to repo after each sync |
| **`.deployignore` Support** | Exclude files during sync (like `.gitignore`) |
| **Rollback** | Revert to any previous commit via `workflow_dispatch` |
| **Toast Notifications** | In-app slide-in notifications for all events |
| **Browser Notifications** | Deploy and walk away — get notified when it's done |
| **Keyboard Shortcuts** | `Ctrl+D` deploy, `Ctrl+L` clear terminal, `Ctrl+K` palette |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    100% Client-Side                        │
│                                                            │
│  Browser (GitHub Pages / localhost)                        │
│  ├── OAuth 2.0 login (Web Application Flow)               │
│  ├── Multi-format upload (folder/files/zip via JSZip CDN) │
│  ├── Smart workflow file pre-push (Contents API)          │
│  ├── ZIP upload → GitHub Contents API                     │
│  ├── Live Actions status polling                          │
│  └── All state in localStorage (zero server state)        │
│                                                            │
│  Cloudflare Worker (stateless proxy)                      │
│  └── Exchanges OAuth code for token (hides CLIENT_SECRET) │
│                                                            │
│  GitHub Actions (heavy lifting)                           │
│  ├── Extract workspace.zip                                │
│  ├── Apply .deployignore rules                            │
│  ├── Sync files (merge or replace mode)                   │
│  ├── Write deployment receipt                             │
│  └── Commit & push                                        │
└────────────────────────────────────────────────────────────┘
```

### Smart Workflow File Handling

GitHub Actions' `GITHUB_TOKEN` cannot write to `.github/workflows/*.yml`. DemonZ Deployer v3.0.0 solves this transparently:

1. JSZip inspects the uploaded zip client-side
2. Detects any `.github/workflows/*.yml` files
3. Pushes them directly via the GitHub Contents API (the OAuth token has `workflow` scope)
4. Uploads the remaining zip for Actions to handle

**Zero PAT required. Zero user configuration. Works on mobile.**

---

## Quick Start

### 1. Create a GitHub OAuth App

Go to **GitHub Settings → Developer Settings → OAuth Apps → New OAuth App**

| Field | Value |
|:---|:---|
| Homepage URL | `https://<you>.github.io/DemonZ-Deployer/` |
| Authorization callback URL | `https://<you>.github.io/DemonZ-Deployer/` |

Copy the **Client ID** into `js/config.js`.

### 2. Deploy the Cloudflare Worker

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) → Create Worker
2. Paste the contents of `worker/worker.js`
3. In Worker Settings → Variables → add `CLIENT_SECRET` as a **Secret**
4. Save & Deploy
5. Copy the `*.workers.dev` URL into `js/config.js`

### 3. Deploy to GitHub Pages

```bash
git push origin main
```

Then enable GitHub Pages in your repo settings (Settings → Pages → Branch: main → Save).

### 4. Sign In & Deploy

1. Open your GitHub Pages URL
2. Click **Connect with GitHub**
3. Select a repository → Click **Setup Repository** (installs the pipeline)
4. Drop your workspace files → Click **Deploy**

---

## Pipeline Version Detection

The pipeline YAML contains a machine-readable version tag:

```yaml
# DZ_PIPELINE_VERSION=3.0.0
```

When you select a repository, the app reads this tag and shows:
- ✅ **Pipeline v3.0.0** — up to date
- ⚠️ **Pipeline (legacy)** — upgrade available → one-click upgrade button

---

## Deploy Modes

| Mode | Behavior |
|:---|:---|
| **Merge** (default) | Overlays extracted files onto existing repo contents |
| **Replace** | Clears all tracked files first, then syncs (clean slate) |

The mode is embedded in the commit message as `[mode:merge]` or `[mode:replace]` and read by the pipeline.

---

## `.deployignore`

Create a `.deployignore` file in your repo root or include one in your workspace zip. Works like `.gitignore`:

```
node_modules
.env
*.log
dist/
```

The pipeline will exclude matching files during sync.

---

## Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Ctrl+K` | Open command palette |
| `Ctrl+D` | Deploy workspace |
| `Ctrl+L` | Clear terminal |
| `Esc` | Close modal / palette |

---

## License

MIT — see [LICENSE](LICENSE)

---

*Forging Digital Empires — **DemonZ Development***
