/**
 * DemonZ Deployer — Deployment Orchestration
 *
 * Workflow content is always fetched live from the DemonZ-Deployer
 * repository so target repos always get the latest version.
 */

const Deploy = (() => {

  /* ── Fetch the pipeline YAML from the deployer repo itself ── */
  async function _fetchWorkflowContent() {
    try {
      const file = await API.getFile(CONFIG.DEPLOYER_REPO, CONFIG.WORKFLOW_PATH);
      // GitHub returns content as base64 — use it directly for putFile
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

  /* ── Pull workflow from deployer repo and push to target repo ── */
  async function installWorkflow(repo, branch) {
    Terminal.log(`Fetching latest workflow from ${CONFIG.DEPLOYER_REPO}...`, 'info');
    const content = await _fetchWorkflowContent();

    // Check for existing file (need SHA to overwrite)
    let sha = null;
    try {
      const existing = await API.getFile(repo, CONFIG.WORKFLOW_PATH, branch);
      sha = existing.sha;
      Terminal.log('Existing workflow found — will overwrite with latest version.', 'warn', 'wn');
    } catch (e) {
      if (e.status !== 404) throw e;
      Terminal.log('No existing workflow — creating new.', 'info', 'in');
    }

    await API.putFile(
      repo,
      CONFIG.WORKFLOW_PATH,
      'ci: install DemonZ Deployer pipeline',
      content,
      sha,
      branch
    );

    Terminal.log('Deployment pipeline installed successfully.', 'success', 'ok');
  }

  /* ── Main deploy sequence ── */
  async function run({ repo, branch, file, onProgress }) {
    const prog = onProgress || (() => {});

    prog(5);
    Terminal.log(`Initiating deployment → ${repo} [${branch}]`, 'sys', 'in');

    // 1 — Encode
    Pipeline.setStep('auth', 'active');
    let b64;
    try {
      Terminal.log('Encoding artifact to Base64…', 'info');
      b64 = await _readB64(file);
      Pipeline.setStep('auth',   'done'); Pipeline.setConn(1, true);
      Pipeline.setStep('encode', 'active');
      prog(22);
      Terminal.log('Encoding complete.', 'success', 'ok');
      Pipeline.setStep('encode', 'done'); Pipeline.setConn(2, true);
    } catch (err) {
      Pipeline.setStep('auth', 'err');
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
      Pipeline.setStep('check', 'done'); Pipeline.setConn(3, true);
    } catch (err) {
      if (err.status === 404) {
        Terminal.log('No existing workspace.zip — will create.', 'info', 'in');
        Pipeline.setStep('check', 'done'); Pipeline.setConn(3, true);
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
        'chore: deploy workspace.zip via DemonZ Deployer',
        b64,
        sha,
        branch
      );
      prog(90);

      const commitSha = result?.commit?.sha;
      const verb = sha ? 'Updated' : 'Created';
      Terminal.log(`${verb} workspace.zip. Commit: ${commitSha ? commitSha.slice(0, 14) : 'n/a'}`, 'success', 'ok');
      Terminal.log('GitHub Actions pipeline will extract the workspace automatically.', 'success', 'ok');

      Pipeline.setStep('upload', 'done'); Pipeline.setConn(4, true);
      Pipeline.setStep('done',   'done');
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
      401: 'Invalid or expired token — try signing out and back in.',
      403: 'Permission denied — check your token scopes.',
      404: 'Repository not found — check the name and your access.',
      422: 'GitHub rejected the payload — file may exceed the 100 MB API limit.',
    };
    return map[err.status] || err.message;
  }

  return { run, installWorkflow, checkWorkflowInstalled };
})();
