/**
 * DemonZ Deployer — Deployment Orchestration (v3.0.0)
 *
 * Handles:
 *   - Smart workflow file detection & pre-push
 *   - Custom commit messages & deploy modes
 *   - Pipeline version checking
 *   - Workflow installation with version tagging
 */

const Deploy = (() => {

  /* ── Fetch the pipeline YAML from the deployer repo itself ── */
  async function _fetchWorkflowContent() {
    try {
      const file = await API.getFile(CONFIG.DEPLOYER_REPO, CONFIG.WORKFLOW_PATH);
      return file.content.replace(/\n/g, '');
    } catch (e) {
      throw new Error(`Could not fetch workflow from ${CONFIG.DEPLOYER_REPO}: ${e.message}`);
    }
  }

  /* ── Check if workflow is present in target repo ── */
  async function checkWorkflowInstalled(repo, branch) {
    try {
      await API.getFile(repo, CONFIG.WORKFLOW_PATH, branch);
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  }

  /**
   * Check the installed pipeline version in a target repo.
   * Reads the YAML and looks for: # DZ_PIPELINE_VERSION=X.Y.Z
   *
   * @returns {{ installed: boolean, version: string|null, current: boolean }}
   */
  async function checkPipelineVersion(repo, branch) {
    try {
      const file = await API.getFile(repo, CONFIG.WORKFLOW_PATH, branch);
      // Decode the base64 content
      const content = atob(file.content.replace(/\n/g, ''));
      const match = content.match(/DZ_PIPELINE_VERSION=(\S+)/);

      if (match) {
        const installedVersion = match[1];
        return {
          installed: true,
          version: installedVersion,
          current: installedVersion === CONFIG.PIPELINE_VERSION,
        };
      }

      // Pipeline exists but no version tag → old version
      return { installed: true, version: 'legacy', current: false };
    } catch (e) {
      if (e.status === 404) return { installed: false, version: null, current: false };
      throw e;
    }
  }

  /* ── Pull workflow from deployer repo and push to target repo ── */
  async function installWorkflow(repo, branch) {
    Terminal.log(`Fetching latest pipeline (v${CONFIG.PIPELINE_VERSION}) from ${CONFIG.DEPLOYER_REPO}…`, 'info');
    const content = await _fetchWorkflowContent();

    let sha = null;
    try {
      const existing = await API.getFile(repo, CONFIG.WORKFLOW_PATH, branch);
      sha = existing.sha;
      Terminal.log('Existing pipeline found — upgrading to latest version.', 'warn', 'wn');
    } catch (e) {
      if (e.status !== 404) throw e;
      Terminal.log('No existing pipeline — creating new.', 'info', 'in');
    }

    await API.putFile(
      repo,
      CONFIG.WORKFLOW_PATH,
      `ci: install DemonZ Deployer pipeline v${CONFIG.PIPELINE_VERSION}`,
      content,
      sha,
      branch
    );

    Terminal.log(`Pipeline v${CONFIG.PIPELINE_VERSION} installed successfully.`, 'success', 'ok');
  }

  /**
   * Push workflow files from the user's zip directly via Contents API.
   * This bypasses the GITHUB_TOKEN limitation on workflow files.
   *
   * @param {string} repo
   * @param {string} branch
   * @param {Array}  workflowFiles — [{ path, contentBase64 }]
   */
  async function pushWorkflowFiles(repo, branch, workflowFiles) {
    Terminal.log(`Detected ${workflowFiles.length} workflow file${workflowFiles.length > 1 ? 's' : ''} — pushing directly via API…`, 'info', 'in');

    for (const wf of workflowFiles) {
      let sha = null;
      try {
        const existing = await API.getFile(repo, wf.path, branch);
        sha = existing.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      await API.putFile(
        repo,
        wf.path,
        `ci: update ${wf.path} via DemonZ Deployer`,
        wf.contentBase64,
        sha,
        branch
      );

      Terminal.log(`  ✓ ${wf.path}`, 'success');
    }

    Terminal.log('All workflow files pushed successfully.', 'success', 'ok');
  }

  /* ── Main deploy sequence ── */
  async function run({ repo, branch, file, onProgress, commitMsg, deployMode }) {
    const prog = onProgress || (() => {});
    const msg = commitMsg || CONFIG.DEFAULT_COMMIT_MSG;
    const mode = deployMode || 'merge';

    // Append deploy mode metadata to commit message
    const fullMsg = `${msg}\n\n[mode:${mode}]`;

    prog(5);
    Terminal.log(`Initiating deployment → ${repo} [${branch}] (${mode} mode)`, 'sys', 'in');

    // 0 — Smart workflow file pre-push
    let workflowFilesInZip = [];
    try {
      workflowFilesInZip = await Inspector.extractWorkflowFiles(file);
    } catch {
      // Not critical — might not be a zip or JSZip not available
    }

    if (workflowFilesInZip.length > 0) {
      Pipeline.setStep('auth', 'active');
      prog(8);
      try {
        await pushWorkflowFiles(repo, branch, workflowFilesInZip);
        Pipeline.setStep('auth', 'done');
        Pipeline.setConn(1, true);
        prog(15);
      } catch (err) {
        Terminal.log(`Workflow pre-push failed: ${err.message}. Continuing with zip upload.`, 'warn', 'wn');
        Pipeline.setStep('auth', 'done');
        Pipeline.setConn(1, true);
      }
    } else {
      Pipeline.setStep('auth', 'done');
      Pipeline.setConn(1, true);
    }

    // 1 — Encode
    Pipeline.setStep('encode', 'active');
    let b64;
    try {
      Terminal.log('Encoding artifact to Base64…', 'info');
      b64 = await _readB64(file);
      prog(25);
      Terminal.log('Encoding complete.', 'success', 'ok');
      Pipeline.setStep('encode', 'done');
      Pipeline.setConn(2, true);
    } catch (err) {
      Pipeline.setStep('encode', 'err');
      Terminal.log(`Encoding failed: ${err.message}`, 'error', 'er');
      return { ok: false };
    }

    // 2 — SHA check
    Pipeline.setStep('check', 'active');
    prog(40);
    let sha = null;
    try {
      Terminal.log(`Checking for existing workspace.zip in ${repo}…`, 'info');
      const existing = await API.getFile(repo, 'workspace.zip', branch);
      sha = existing.sha;
      Terminal.log(`Existing file found. SHA: ${sha.slice(0, 14)}… — overwrite mode.`, 'warn', 'wn');
      Pipeline.setStep('check', 'done');
      Pipeline.setConn(3, true);
    } catch (err) {
      if (err.status === 404) {
        Terminal.log('No existing workspace.zip — will create.', 'info', 'in');
        Pipeline.setStep('check', 'done');
        Pipeline.setConn(3, true);
      } else {
        Pipeline.setStep('check', 'err');
        Terminal.log(`Repository check failed: ${_humanError(err)}`, 'error', 'er');
        return { ok: false };
      }
    }

    // 3 — Upload
    Pipeline.setStep('upload', 'active');
    prog(65);
    try {
      Terminal.log('Transmitting payload via GitHub Contents API…', 'info');
      const result = await API.putFile(
        repo,
        'workspace.zip',
        fullMsg,
        b64,
        sha,
        branch
      );
      prog(90);

      const commitSha = result?.commit?.sha;
      const verb = sha ? 'Updated' : 'Created';
      Terminal.log(`${verb} workspace.zip. Commit: ${commitSha ? commitSha.slice(0, 14) : 'n/a'}`, 'success', 'ok');
      Terminal.log('GitHub Actions pipeline will extract the workspace automatically.', 'success', 'ok');

      Pipeline.setStep('upload', 'done');
      Pipeline.setConn(4, true);
      Pipeline.setStep('done', 'done');
      prog(100);

      return { ok: true, commitSha, repo };
    } catch (err) {
      Pipeline.setStep('upload', 'err');
      Terminal.log(`Upload failed: ${_humanError(err)}`, 'error', 'er');
      return { ok: false };
    }
  }

  /* ── Helpers ── */
  function _readB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result.split(',')[1]);
      r.onerror = () => reject(new Error('FileReader error'));
      r.readAsDataURL(file);
    });
  }

  function _humanError(err) {
    const map = {
      0:   'Network error — check your internet connection.',
      401: 'Invalid or expired token — try signing out and back in.',
      403: 'Permission denied — check your token scopes.',
      404: 'Repository not found — check the name and your access.',
      409: 'Conflict — the file was modified while deploying. Try again.',
      422: 'GitHub rejected the payload — file may exceed the 100 MB API limit.',
      429: 'Rate limited — wait a moment and try again.',
      500: 'GitHub server error — try again in a few moments.',
      502: 'GitHub is temporarily unavailable — try again shortly.',
      503: 'GitHub service unavailable — try again shortly.',
    };
    return map[err.status] || err.message;
  }

  return { run, installWorkflow, checkWorkflowInstalled, checkPipelineVersion, pushWorkflowFiles };
})();
