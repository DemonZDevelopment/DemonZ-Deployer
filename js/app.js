/**
 * DemonZ Deployer — Main Application Controller
 * Manages views, state, and user interactions.
 */

const App = (() => {

  /* ── App state ── */
  let state = {
    user:              null,
    repos:             [],
    branches:          [],
    selectedRepo:      null,
    selectedBranch:    'main',
    selectedFile:      null,
    isDeploying:       false,
    workflowInstalled: false,
  };

  /* ── DOM refs (populated in init) ── */
  let D = {};
  const $ = id => document.getElementById(id);

  /* ════════════════════════════ INIT ══ */
  function init() {
    D = {
      // Views
      loginView:          $('loginView'),
      appView:            $('appView'),
      // Login
      connectBtn:         $('connectBtn'),
      connectSpinner:     $('connectSpinner'),
      connectLabel:       $('connectLabel'),
      deviceCodeWrap:     $('deviceCodeWrap'),
      deviceCode:         $('deviceCode'),
      openGithubBtn:      $('openGithubBtn'),
      authStatus:         $('authStatus'),
      cancelAuthBtn:      $('cancelAuthBtn'),
      // Header / user
      userAvatar:         $('userAvatar'),
      userName:           $('userName'),
      logoutBtn:          $('logoutBtn'),
      statusPill:         $('statusPill'),
      statusLabel:        $('statusLabel'),
      liveDot:            $('liveDot'),
      // Repo panel
      repoSearch:         $('repoSearch'),
      repoDropdown:       $('repoDropdown'),
      branchSelect:       $('branchSelect'),
      setupRepoBtn:       $('setupRepoBtn'),
      workflowBadge:      $('workflowBadge'),
      createRepoBtn:      $('createRepoBtn'),
      // Deploy panel
      dropzone:           $('dropzone'),
      fileInput:          $('fileInput'),
      dzFileName:         $('dzFileName'),
      dzFileMeta:         $('dzFileMeta'),
      deployBtn:          $('deployBtn'),
      deployLabel:        $('deployLabel'),
      deploySpinner:      $('deploySpinner'),
      clearBtn:           $('clearBtn'),
      progRow:            $('progRow'),
      progFill:           $('progFill'),
      progLabel:          $('progLabel'),
      terminal:           $('terminal'),
      clearTermBtn:       $('clearTermBtn'),
      copyTermBtn:        $('copyTermBtn'),
      // Create repo modal
      createRepoModal:    $('createRepoModal'),
      newRepoName:        $('newRepoName'),
      newRepoDesc:        $('newRepoDesc'),
      newRepoPrivate:     $('newRepoPrivate'),
      createRepoSubmit:   $('createRepoSubmit'),
      createRepoCancel:   $('createRepoCancel'),
      createRepoCancelFooter: $('createRepoCancelFooter'),
    };

    Terminal.init(D.terminal);
    _bindEvents();

    // Restore existing session if present
    const session = Auth.loadSession();
    if (session) {
      API.setToken(session.token);
      _loginSuccess(session.user, false);
    }

    lucide.createIcons();
  }

  /* ════════════════════════════ EVENT BINDING ══ */
  function _bindEvents() {
    // ── Auth
    D.connectBtn.addEventListener('click',    _startAuth);
    D.cancelAuthBtn.addEventListener('click', () => { Auth.cancel(); _showLoginInitial(); });
    D.logoutBtn.addEventListener('click',     _logout);

    // ── Repo search dropdown
    D.repoSearch.addEventListener('focus',  () => _showDropdown());
    D.repoSearch.addEventListener('input',  _filterRepos);
    document.addEventListener('click', e => {
      if (!D.repoSearch.contains(e.target) && !D.repoDropdown.contains(e.target)) {
        _hideDropdown();
      }
    });

    // ── Branch
    D.branchSelect.addEventListener('change', () => {
      state.selectedBranch = D.branchSelect.value;
      _checkWorkflowStatus();
    });

    // ── Setup repo
    D.setupRepoBtn.addEventListener('click', _setupRepo);

    // ── Create repo modal
    D.createRepoBtn.addEventListener('click',           () => _showModal());
    D.createRepoCancel.addEventListener('click',        () => _hideModal());
    D.createRepoCancelFooter.addEventListener('click',  () => _hideModal());
    D.createRepoModal.addEventListener('click', e => {
      if (e.target === D.createRepoModal) _hideModal();
    });
    D.createRepoSubmit.addEventListener('click', _createRepo);
    D.newRepoName.addEventListener('keydown', e => { if (e.key === 'Enter') _createRepo(); });

    // ── File drop
    D.dropzone.addEventListener('click',    () => D.fileInput.click());
    D.dropzone.addEventListener('keydown',  e => { if (e.key === 'Enter' || e.key === ' ') D.fileInput.click(); });
    D.dropzone.addEventListener('dragover', e => { e.preventDefault(); D.dropzone.classList.add('dragover'); });
    D.dropzone.addEventListener('dragleave',  () => D.dropzone.classList.remove('dragover'));
    D.dropzone.addEventListener('drop', e => {
      e.preventDefault();
      D.dropzone.classList.remove('dragover');
      _handleFile(e.dataTransfer.files[0]);
    });
    D.fileInput.addEventListener('change', () => {
      if (D.fileInput.files[0]) _handleFile(D.fileInput.files[0]);
    });

    // ── Deploy actions
    D.deployBtn.addEventListener('click',    _runDeploy);
    D.clearBtn.addEventListener('click',     _clearDeploy);
    D.clearTermBtn.addEventListener('click', () => Terminal.clear());
    D.copyTermBtn.addEventListener('click',  () => {
      Terminal.copyAll();
      Terminal.log('Logs copied to clipboard.', 'sys');
    });
  }

  /* ════════════════════════════ AUTH ══ */
  async function _startAuth() {
    D.connectBtn.disabled     = true;
    D.connectSpinner.classList.remove('hidden');
    D.connectLabel.textContent = 'Requesting code…';

    try {
      const { device_code, user_code, verification_uri, interval } =
        await Auth.requestDeviceCode();

      // Show device code UI
      D.deviceCode.textContent  = user_code;
      D.openGithubBtn.href      = verification_uri;
      D.deviceCodeWrap.classList.remove('hidden');
      D.connectBtn.classList.add('hidden');
      D.authStatus.textContent  = 'Waiting for you to approve on GitHub…';
      D.authStatus.style.color  = '';

      const token = await Auth.pollForToken(device_code, interval);
      D.authStatus.textContent  = 'Approved! Loading your profile…';

      API.setToken(token);
      const user = await API.getUser();
      Auth.saveSession(token, user);
      _loginSuccess(user, true);

    } catch (err) {
      D.authStatus.textContent = `Error: ${err.message}`;
      D.authStatus.style.color = 'var(--error)';
      _showLoginInitial();
    }
  }

  function _showLoginInitial() {
    D.deviceCodeWrap.classList.add('hidden');
    D.connectBtn.classList.remove('hidden');
    D.connectBtn.disabled = false;
    D.connectSpinner.classList.add('hidden');
    D.connectLabel.textContent = 'Connect with GitHub';
  }

  async function _loginSuccess(user, fresh) {
    state.user = user;

    D.loginView.classList.add('hidden');
    D.appView.classList.remove('hidden');

    D.userAvatar.src        = user.avatar_url;
    D.userName.textContent  = user.login;

    lucide.createIcons(); // re-init icons in freshly shown view

    Terminal.log(`Authenticated as ${user.login}.`, 'success', 'ok');

    if (fresh) Terminal.log('Token stored in sessionStorage — cleared automatically when you close this tab.', 'dim');

    await _loadRepos();
  }

  function _logout() {
    Auth.clearSession();
    state = {
      user: null, repos: [], branches: [],
      selectedRepo: null, selectedBranch: 'main',
      selectedFile: null, isDeploying: false, workflowInstalled: false,
    };
    D.appView.classList.add('hidden');
    D.loginView.classList.remove('hidden');
    _showLoginInitial();
    D.authStatus.textContent = '';
  }

  /* ════════════════════════════ REPOS ══ */
  async function _loadRepos() {
    Terminal.log('Loading repositories…', 'dim');
    try {
      // Fetch up to 2 pages (200 repos) — sufficient for most users
      const page1 = await API.listRepos(1);
      const page2 = page1.length === 100 ? await API.listRepos(2) : [];
      state.repos = [...page1, ...page2];
      Terminal.log(`Loaded ${state.repos.length} repositor${state.repos.length === 1 ? 'y' : 'ies'}.`, 'success', 'ok');
      _renderRepoList(state.repos);
    } catch (err) {
      Terminal.log(`Failed to load repositories: ${err.message}`, 'error', 'er');
    }
  }

  function _renderRepoList(repos) {
    D.repoDropdown.innerHTML = '';

    if (!repos.length) {
      D.repoDropdown.innerHTML = '<div class="repo-item dim">No repositories found</div>';
      return;
    }

    repos.forEach(r => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `
        <span class="repo-item-name">${r.full_name}</span>
        <span class="repo-item-meta">${r.private ? '🔒' : '🌐'} ${r.default_branch}</span>
      `;
      item.addEventListener('click', () => _selectRepo(r));
      D.repoDropdown.appendChild(item);
    });
  }

  function _showDropdown() { D.repoDropdown.classList.remove('hidden'); }
  function _hideDropdown()  { D.repoDropdown.classList.add('hidden');    }

  function _filterRepos() {
    const q = D.repoSearch.value.toLowerCase().trim();
    const filtered = q
      ? state.repos.filter(r => r.full_name.toLowerCase().includes(q))
      : state.repos;
    _renderRepoList(filtered);
    _showDropdown();
  }

  async function _selectRepo(repo) {
    state.selectedRepo   = repo.full_name;
    D.repoSearch.value   = repo.full_name;
    _hideDropdown();

    Terminal.log(`Selected: ${repo.full_name}`, 'info', 'in');

    await _loadBranches(repo.full_name, repo.default_branch);
    _checkReady();
  }

  /* ════════════════════════════ BRANCHES ══ */
  async function _loadBranches(repo, defaultBranch = 'main') {
    D.branchSelect.innerHTML = '<option>Loading…</option>';
    D.branchSelect.disabled  = true;

    try {
      state.branches = await API.listBranches(repo);
      D.branchSelect.innerHTML = state.branches
        .map(b => `<option value="${b.name}"${b.name === defaultBranch ? ' selected' : ''}>${b.name}</option>`)
        .join('');
      D.branchSelect.disabled = false;
      state.selectedBranch    = defaultBranch;
      await _checkWorkflowStatus();
    } catch (err) {
      D.branchSelect.innerHTML = `<option value="${defaultBranch}">${defaultBranch}</option>`;
      D.branchSelect.disabled  = false;
      Terminal.log(`Could not load branches: ${err.message}`, 'warn', 'wn');
    }
  }

  /* ════════════════════════════ WORKFLOW STATUS ══ */
  async function _checkWorkflowStatus() {
    if (!state.selectedRepo) return;

    _setWorkflowBadge('neutral', 'circle-dashed', 'Checking…');
    D.setupRepoBtn.disabled = true;

    try {
      const installed = await Deploy.checkWorkflowInstalled(state.selectedRepo, state.selectedBranch);
      state.workflowInstalled = installed;

      if (installed) {
        _setWorkflowBadge('ok',   'circle-check',   '✓ Deployment pipeline installed');
        D.setupRepoBtn.textContent = '↺ Reinstall Workflow';
      } else {
        _setWorkflowBadge('warn', 'triangle-alert', '⚠ Pipeline not installed — click Setup');
        D.setupRepoBtn.textContent = 'Setup Repository';
      }
    } catch {
      _setWorkflowBadge('neutral', 'circle-dashed', 'Could not check workflow status');
    } finally {
      D.setupRepoBtn.disabled = !state.selectedRepo;
      lucide.createIcons();
    }
  }

  function _setWorkflowBadge(cls, icon, text) {
    D.workflowBadge.className = `workflow-badge ${cls}`;
    D.workflowBadge.innerHTML = `<i data-lucide="${icon}"></i>${text}`;
  }

  /* ════════════════════════════ SETUP REPO ══ */
  async function _setupRepo() {
    if (!state.selectedRepo) return;
    D.setupRepoBtn.disabled   = true;
    D.setupRepoBtn.textContent = 'Installing…';

    try {
      await Deploy.installWorkflow(state.selectedRepo, state.selectedBranch);
      state.workflowInstalled  = true;
      _setWorkflowBadge('ok', 'circle-check', '✓ Deployment pipeline installed');
      D.setupRepoBtn.textContent = '↺ Reinstall Workflow';
      lucide.createIcons();
    } catch (err) {
      Terminal.log(`Workflow install failed: ${err.message}`, 'error', 'er');
      D.setupRepoBtn.textContent = 'Setup Repository';
    } finally {
      D.setupRepoBtn.disabled = false;
    }
  }

  /* ════════════════════════════ CREATE REPO ══ */
  function _showModal() {
    D.createRepoModal.classList.remove('hidden');
    D.newRepoName.focus();
  }

  function _hideModal() {
    D.createRepoModal.classList.add('hidden');
    D.newRepoName.value  = '';
    D.newRepoDesc.value  = '';
    D.newRepoPrivate.checked = false;
  }

  async function _createRepo() {
    const name = D.newRepoName.value.trim();
    if (!name) { D.newRepoName.focus(); return; }

    D.createRepoSubmit.disabled = true;
    D.createRepoSubmit.querySelector('span').textContent = 'Creating…';

    try {
      const repo = await API.createRepo(
        name,
        D.newRepoDesc.value.trim(),
        D.newRepoPrivate.checked
      );
      Terminal.log(`Repository created: ${repo.full_name}`, 'success', 'ok');
      _hideModal();
      await _loadRepos();
      // Auto-select the newly created repo
      const newRepo = state.repos.find(r => r.full_name === repo.full_name);
      if (newRepo) _selectRepo(newRepo);
    } catch (err) {
      Terminal.log(`Failed to create repository: ${err.message}`, 'error', 'er');
    } finally {
      D.createRepoSubmit.disabled = false;
      D.createRepoSubmit.querySelector('span').textContent = 'Create Repository';
    }
  }

  /* ════════════════════════════ FILE HANDLING ══ */
  function _handleFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      D.dropzone.className = 'dropzone file-err';
      state.selectedFile   = null;
      Terminal.log(`Rejected "${file.name}" — only .zip files are accepted.`, 'error', 'er');
      _checkReady();
      return;
    }

    const sizeMB = file.size / 1_048_576;
    if (sizeMB > 50) {
      Terminal.log(
        `Warning: ${file.name} is ${sizeMB.toFixed(1)} MB. GitHub's Contents API has a ~50 MB limit — upload may fail.`,
        'warn', 'wn'
      );
    }

    D.dropzone.className       = 'dropzone has-file';
    state.selectedFile         = file;
    D.dzFileName.textContent   = file.name;
    D.dzFileMeta.textContent   = `${_fmtBytes(file.size)} · will be deployed as workspace.zip`;

    Terminal.log(`Artifact staged: ${file.name} (${_fmtBytes(file.size)})`, 'success', 'ok');
    _checkReady();
  }

  function _fmtBytes(b) {
    if (b < 1_024)       return `${b} B`;
    if (b < 1_048_576)   return `${(b / 1_024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(2)} MB`;
  }

  /* ════════════════════════════ DEPLOY ══ */
  function _checkReady() {
    D.deployBtn.disabled = !(state.selectedRepo && state.selectedFile && !state.isDeploying);
  }

  async function _runDeploy() {
    if (!state.selectedRepo || !state.selectedFile || state.isDeploying) return;

    state.isDeploying = true;
    _setBusy(true);
    Pipeline.reset();
    _setStatus('Deploying', 'live');

    const result = await Deploy.run({
      repo:       state.selectedRepo,
      branch:     state.selectedBranch,
      file:       state.selectedFile,
      onProgress: _setProg,
    });

    state.isDeploying = false;
    _setBusy(false);

    if (result.ok) {
      _setStatus('Complete', 'live');

      if (result.commitSha) {
        const commitUrl  = `https://github.com/${result.repo}/commit/${result.commitSha}`;
        const actionsUrl = `https://github.com/${result.repo}/actions`;
        Terminal.log(`Commit URL    → ${commitUrl}`, 'sys');
        Terminal.log(`Actions URL   → ${actionsUrl}`, 'sys');
      }
    } else {
      _setStatus('Failed', 'error');
      Terminal.log('Deployment terminated. Check credentials and repository permissions.', 'dim');
    }

    setTimeout(() => _setProg(null), 1500);
    _checkReady();
  }

  function _clearDeploy() {
    state.selectedFile     = null;
    D.fileInput.value      = '';
    D.dropzone.className   = 'dropzone';
    D.dzFileName.textContent = '';
    D.dzFileMeta.textContent = '';
    _setProg(null);
    Pipeline.reset();
    _setStatus('Idle', '');
    _checkReady();
    Terminal.log('Session cleared.', 'dim');
  }

  /* ════════════════════════════ UI HELPERS ══ */
  function _setBusy(busy) {
    D.deployBtn.disabled                     = busy;
    D.deploySpinner.classList.toggle('hidden', !busy);
    const icon = D.deployBtn.querySelector('.deploy-icon');
    if (icon) icon.style.display             = busy ? 'none' : '';
    D.deployLabel.textContent                = busy ? 'Deploying…' : 'Deploy Workspace';
  }

  function _setStatus(label, mode) {
    D.statusLabel.textContent = label;
    D.statusPill.className    =
      mode === 'live'  ? 'hpill live'    :
      mode === 'error' ? 'hpill error-s' : 'hpill';
  }

  function _setProg(pct) {
    if (pct === null) { D.progRow.classList.remove('show'); return; }
    D.progRow.classList.add('show');
    D.progFill.style.width    = `${pct}%`;
    D.progLabel.textContent   = `${pct}%`;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
