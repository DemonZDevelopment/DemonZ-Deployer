<div align="center">
  <img src="https://raw.githubusercontent.com/DemonZDevelopment/DemonZ-Deployer/main/assets/banner.png" alt="DemonZ Deployer - Serverless GitHub Deployment Engine" width="100%">
</div>

<br/>

<div align="center">

# DemonZ Deployer v2.0.2

**A zero‑friction, serverless continuous deployment (CD) engine built for mobile‑first developers.**

[![Version](https://img.shields.io/badge/Version-2.0.2-ff7b2f?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-c061ff?style=flat-square)](./LICENSE)
[![Architecture](https://img.shields.io/badge/Architecture-Serverless-7070a0?style=flat-square)](#)
[![Live App](https://img.shields.io/badge/🚀_Launch_App-GitHub_Pages-3de89e?style=flat-square)](https://demonzdevelopment.github.io/DemonZ-Deployer/)
[![npm](https://img.shields.io/badge/npm-@demonzdevelopment/demonz--deployer-cb3837?style=flat-square&logo=npm)](#)

<br/>

### [🚀 Open the Deployment Console →](https://demonzdevelopment.github.io/DemonZ-Deployer/)

<br/>

*Engineered by **[DemonZ Development](https://demonzdevelopment.online)** for seamless integration with Android, Termux, and mobile IDEs.*

</div>

---

## 📦 Installation

DemonZ Deployer is a client‑side tool that runs entirely in your browser.  
For local development or self‑hosting, you can install the package via npm:

`npm install @demonzdevelopment/demonz-deployer`

The package includes the frontend assets, Cloudflare Worker proxy script, and configuration templates. Refer to the Self‑Hosting section for setup instructions.

---

## 📌 Overview

Deploying complex, multi‑directory projects from a mobile browser to GitHub is notoriously unstable. DemonZ Deployer eliminates the need for a local Git CLI or a dedicated backend. Developers simply compress their workspace into a `workspace.zip` archive and upload it through our browser‑based console. The engine securely streams the binary to the GitHub REST API, triggering an automated Actions pipeline that extracts, verifies, and commits the changes directly to your repository.

No manual token generation. No infrastructure. No friction.

<div align="center">
  <img src="https://raw.githubusercontent.com/DemonZDevelopment/DemonZ-Deployer/main/assets/features.png" alt="DemonZ Deployer Feature Matrix: Mobile-First, Serverless, Secure, Automated" width="100%">
</div>

---

## ✨ Core Features (v2.0.2)

The v2.0.2 OAuth Update introduces a hardened, modular architecture optimised for security and speed.

* **GitHub Device Flow (OAuth 2.0)** – Effortless, secure authentication. No manual Personal Access Token (PAT) generation required.
* **100% Serverless Architecture** – Operates entirely in the browser, supported by a highly restricted Cloudflare Worker CORS proxy.
* **Live Repository Integration** – Instantly search, filter, and select from your personal and organisational repositories.
* **Automated Pipeline Installation** – Install the required GitHub Actions extraction workflow into any target repository with a single click.
* **Volatile Session Security** – Access tokens are stored securely in `localStorage` ensuring your session persists smoothly.

---

## 🚀 Usage Guide

DemonZ Deployer requires zero installation and operates entirely within your browser.

1. **Authenticate**
   Navigate to the Deployer Console and click Connect with GitHub. Follow the Device Flow prompts to securely authorise the application.
2. **Select Target**
   Use the live search interface to select your target repository and branch.
3. **Initialize Pipeline (First‑Time Only)**
   If the repository lacks the extraction workflow, click Setup Repository to auto‑install the pipeline.
4. **Deploy Workspace**
   Drag and drop your `workspace.zip` into the staging area and click Deploy.

The integrated terminal will output real‑time progress across all five deployment stages:
`Auth → Encode → SHA Check → Upload → Deployed`

---

## 🔒 Security & Architecture

DemonZ Deployer is built on a **Zero‑Trust Client‑Side Model**. Your code and credentials never touch our servers.

* **Stateless Proxy** – GitHub's OAuth endpoints lack CORS headers. To solve this without a traditional backend, we utilise a stateless Cloudflare Worker. This proxy strictly enforces an origin whitelist, payload size caps (1 KB), and IP‑based rate limiting via Cloudflare KV. It logs nothing.
* **Direct API Commits** – Once authenticated, all file uploads and Git operations are transmitted directly from your browser to `api.github.com`.
* **Smart Delta Commits** – The automated GitHub Actions runner extracts your zip, overlaying the existing codebase. If no structural changes are detected, it cleanly exits without polluting your Git history with empty commits.

---

## 🛠 Troubleshooting Matrix

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Fake 404 on Pipeline Install** | Missing workflow scope in OAuth app | Add the `workflow` scope to your GitHub OAuth application. |
| **Pipeline runs but commit fails** | Missing Actions permissions | In the repository Settings > Actions > General, set "Workflow permissions" to `Read and write permissions`. |
| **HTTP 422 Error on Upload** | Payload too large | Ensure your `workspace.zip` is under 50 MB. |

---

## 💻 Developer & Self‑Hosting Information

For developers wishing to fork this repository or host an internal instance:

1. Register a new **GitHub OAuth Application** and enable Device Flow.
2. Deploy the proxy script located at `worker/worker.js` to **Cloudflare Workers**.
3. Update `js/config.js` with your distinct `CLIENT_ID` and Cloudflare `PROXY_URL`.
4. Host the frontend assets via GitHub Pages or any static CDN.

*Please refer to `CONTRIBUTING.md` for architectural guidelines and PR submission standards.*

---

<div align="center">

**DemonZ Development** – *Forging Digital Empires.*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-c061ff?style=flat-square)](./LICENSE)

</div>
