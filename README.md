<div align="center">
  <img src="assets/banner.png" alt="DemonZ Development Banner" width="100%">
</div>

<div align="center">

# DemonZ Deployer

**A serverless, zero-friction deployment engine to synchronize mobile development workspaces directly to GitHub.**

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#)
[![Author](https://img.shields.io/badge/Author-DemonZ_Development-orange)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Serverless-lightgrey)](#)

</div>

---

## System Overview

Mobile development environments often generate thousands of individual files. Trying to synchronize these local workspaces with remote version control via mobile web browsers usually results in crashes and high friction.

DemonZ Deployer solves this limitation using a hybrid serverless architecture. Instead of uploading files one by one, you transmit a single compressed workspace binary (`workspace.zip`) via a secure client-side interface. This triggers an automated CI/CD pipeline that unpacks, verifies, and commits the structural changes directly to your target repository in the background.

<div align="center">
  <img src="assets/deployer.jpg" alt="DemonZ Deployer Icon" width="150">
</div>

## Repository Navigation

Whether you want to deploy the frontend or copy the backend engine, here is where you can find the core components of this project:

* **[Frontend Interface (index.html)](./index.html)**: The complete client-side web application. You can host this directly on GitHub Pages.
* **[Extraction Pipeline (.github/workflows/deployer-pipeline.yml)](./.github/workflows/deployer-pipeline.yml)**: The GitHub Actions workflow file. This is the engine you will copy into your target repositories.
* **[Branding Assets (assets/)](./assets/)**: The diagrams, logos, and UI mockups used in this documentation.

## Architectural Flow

This deployment sequence requires zero external backend infrastructure, operating entirely through the GitHub REST API and GitHub Actions.

<img src="assets/architecture.png" alt="DemonZ Deployer Architecture Flowchart" width="100%">

1. **Client Authentication:** The static frontend authenticates with the GitHub API using a locally stored Personal Access Token (PAT).
2. **Payload Transmission:** The compressed workspace binary is streamed directly to the repository.
3. **Pipeline Execution:** The arrival of the payload triggers the automated extraction workflow.
4. **Structural Synchronization:** The runner unpacks the payload, purges the initial archive, and executes a clean structural commit to the branch.

## Core Capabilities

<img src="assets/features.png" alt="Features: Mobile-First, Serverless, Security, Automation" width="100%">

* **Mobile-Optimized Interface:** A responsive frontend engineered specifically for constrained mobile displays.
* **Zero-Server Infrastructure:** Operates without external databases, custom workers, or hosting fees.
* **Client-Side Cryptography:** Authentication tokens are stored exclusively in browser local storage and never traverse third-party servers.
* **Failsafe Automation:** The extraction pipeline includes payload integrity verification and bypasses execution if structural changes are identical to the current commit.

## Implementation Guide

To implement the DemonZ Deployer in your own projects, you just need to set up the extraction pipeline in your target repository.

1. Navigate to your target repository on GitHub.
2. Create the following directory path: `.github/workflows/`
3. Copy the contents of the **[deployer-pipeline.yml](./.github/workflows/deployer-pipeline.yml)** file from this repository and save it into that new folder.
4. Optional: Modify the environment variables at the top of the file (such as the bot name and commit message) to match your workflow preferences.

Once the workflow is saved, you can use the DemonZ Deployer frontend to push `.zip` files directly to that repository.

## Security Notice

This application operates exclusively as a static, client-side interface. Personal Access Tokens provided to the application are utilized strictly for authorizing requests to the official GitHub API. DemonZ Development does not collect, proxy, or store user credentials or repository telemetry.

---

<div align="center">
  <b>Engineered by DemonZ Development</b>
</div>
