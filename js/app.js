/**
 * DemonZ Deployer — Main Application Controller (v3.0.0 "Command Center")
 */

const App = (() => {

  /* ── App state ── */
  let state = {
    user:              null,
    repos:             [],
    branches:          [],
    selectedRepo:      null,
    selectedRepoObj:   null,
    selectedBranch:    'main',
    selectedFile:      null,
    selectedFileBlob:  null,   // The actual blob to upload (may differ from file if folder/multi-file)
    isDeploying:       false,
    workflowInstalled: false,
    pipelineVersion:   null,
    uploadMode:        'zip',  // zip | files | folder
    deployMode:        'merge', // merge | replace
    inspectResult:     null,
  };

  /* ── DOM refs ── */
  let D = {};
  const $ = id => document.getElementById(id);

  /* ════════════════════════════ INIT ══ */
  async function init() {
    D = {
      loginView:          $('loginView'),
      appView:            $('appView'),
      connectBtn:         $('connectBtn'),
      connectSpinner:     $('connectSpinner'),
      connectLabel:       $('connectLabel'),
      authStatus:         $('authStatus'),
      userAvatar:         $('userAvatar'),
      userName:           $('userName'),
      logoutBtn:          $('logoutBtn'),
      statusPill:         $('statusPill'),
      statusLabel:        $('statusLabel'),
      liveDot:            $('liveDot'),
      repoSearch:         $('repoSearch'),
      repoDropdown:       $('repoDropdown'),
      branchSelect:       $('branchSelect'),
      setupRepoBtn:       $('setupRepoBtn'),
      workflowBadge:      $('workflowBadge'),
      createRepoBtn:      $('createRepoBtn'),
      createBranchBtn:    $('createBranchBtn'),
      dropzone:           $('dropzone'),
      fileInput:          $('fileInput'),
      folderInput:        $('folderInput'),
      filesInput:         $('filesInput'),
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
      commitMsgInput:     $('commitMsgInput'),
      deployModeSelect:   $('deployModeSelect'),
      inspectorPanel:     $('inspectorPanel'),
      inspectorContent:   $('inspectorContent'),
      dashboardPanel:     $('dashboardPanel'),
      dashboardContent:   $('dashboardContent'),
      historyPanel:       $('historyPanel'),
      historyList:        $('historyList'),
      clearHistoryBtn:    $('clearHistoryBtn'),
      createRepoModal:    $('createRepoModal'),
      newRepoName:        $('newRepoName'),
      newRepoDesc:        $('newRepoDesc'),
      newRepoPrivate:     $('newRepoPrivate'),
      createRepoSubmit:   $('createRepoSubmit'),
      createRepoCancel:   $('createRepoCancel'),
      createRepoCancelFt: $('createRepoCancelFooter'),
      createBranchModal:  $('createBranchModal'),
      newBranchName:      $('newBranchName'),
      branchSourceLabel:  $('branchSourceLabel'),
      createBranchSubmit: $('createBranchSubmit'),
      createBranchCancel: $('createBranchCancel'),
      createBranchCancelFt: $('createBranchCancelFooter'),
      settingsBtn:        $('settingsBtn'),
      soundIcon:          $('soundIcon'),
      toastContainer:     $('toastContainer'),
      paletteOverlay:     $('paletteOverlay'),
      uploadModeZip:      $('uploadModeZip'),
      uploadModeFiles:    $('uploadModeFiles'),
      uploadModeFolder:   $('uploadModeFolder'),
      versionTag:         $('versionTag'),
    };

    Terminal.init(D.terminal);
    Notify.init(D.toastContainer);
    Shortcuts.init();
    Palette.init(D.paletteOverlay);
    _bindEvents();
    _registerPalette();
    _registerShortcuts();
    _updateSoundIcon();
    lucide.createIcons();

    if (D.versionTag) D.versionTag.textContent = `v${CONFIG.VERSION}`;
    if (D.commitMsgInput) D.commitMsgInput.value = CONFIG.DEFAULT_COMMIT_MSG;

    // ── OAuth callback check ──
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode  = urlParams.get('code');
    const oauthState = urlParams.get('state');

    if (oauthCode && oauthState) {
      window.history.replaceState({}, document.title, window.location.pathname);
      await _handleOAuthCallback(oauthCode, oauthState);
      return;
    }

    // ── Existing session ──
    const session = Auth.loadSession();
    if (session) {
      API.setToken(session.token);
      _loginSuccess(session.user, false);
    }
  }

  /* ════════════════════════════ EVENT BINDING ══ */
  function _bindEvents() {
    D.connectBtn.addEventListener('click', _startAuth);
    D.logoutBtn.addEventListener('click',  _logout);

    // Repo search
    D.repoSearch.addEventListener('focus', () => _showDropdown());
    D.repoSearch.addEventListener('input', _filterRepos);
    document.addEventListener('click', e => {
      if (!D.repoSearch.contains(e.target) && !D.repoDropdown.contains(e.target)) _hideDropdown();
    });

    // Branch
    D.branchSelect.addEventListener('change', () => {
      state.selectedBranch = D.branchSelect.value;
      _checkWorkflowStatus();
    });

    // Setup repo & create branch
    D.setupRepoBtn.addEventListener('click', _setupRepo);
    if (D.createBranchBtn) D.createBranchBtn.addEventListener('click', () => _showBranchModal());

    // Create repo modal
    D.createRepoBtn.addEventListener('click', () => _showModal(D.createRepoModal, D.newRepoName));
    D.createRepoCancel.addEventListener('click', () => _hideModal(D.createRepoModal));
    D.createRepoCancelFt.addEventListener('click', () => _hideModal(D.createRepoModal));
    D.createRepoModal.addEventListener('click', e => { if (e.target === D.createRepoModal) _hideModal(D.createRepoModal); });
    D.createRepoSubmit.addEventListener('click', _createRepo);
    D.newRepoName.addEventListener('keydown', e => { if (e.key === 'Enter') _createRepo(); });

    // Create branch modal
    if (D.createBranchModal) {
      D.createBranchCancel.addEventListener('click', () => _hideModal(D.createBranchModal));
      D.createBranchCancelFt.addEventListener('click', () => _hideModal(D.createBranchModal));
      D.createBranchModal.addEventListener('click', e => { if (e.target === D.createBranchModal) _hideModal(D.createBranchModal); });
      D.createBranchSubmit.addEventListener('click', _createBranch);
      D.newBranchName.addEventListener('keydown', e => { if (e.key === 'Enter') _createBranch(); });
    }

    // Upload mode toggles
    if (D.uploadModeZip)    D.uploadModeZip.addEventListener('click',    () => _setUploadMode('zip'));
    if (D.uploadModeFiles)  D.uploadModeFiles.addEventListener('click',  () => _setUploadMode('files'));
    if (D.uploadModeFolder) D.uploadModeFolder.addEventListener('click', () => _setUploadMode('folder'));

    // File drop
    D.dropzone.addEventListener('click', () => _triggerUpload());
    D.dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _triggerUpload(); });
    D.dropzone.addEventListener('dragover', e => { e.preventDefault(); D.dropzone.classList.add('dragover'); });
    D.dropzone.addEventListener('dragleave', () => D.dropzone.classList.remove('dragover'));
    D.dropzone.addEventListener('drop', e => {
      e.preventDefault();
      D.dropzone.classList.remove('dragover');
      const items = e.dataTransfer.items;
      // Check if folder was dropped
      if (items && items.length > 0 && items[0].webkitGetAsEntry) {
        const entry = items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          // Folder dropped — use folder mode
          _setUploadMode('folder');
          _handleDroppedFolder(e.dataTransfer);
          return;
        }
      }
      // Single or multiple files
      const files = e.dataTransfer.files;
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        _handleZipFile(files[0]);
      } else if (files.length > 0) {
        _handleMultipleFiles(files);
      }
    });

    D.fileInput.addEventListener('change', () => {
      if (D.fileInput.files[0]) _handleZipFile(D.fileInput.files[0]);
    });
    if (D.filesInput) D.filesInput.addEventListener('change', () => {
      if (D.filesInput.files.length > 0) _handleMultipleFiles(D.filesInput.files);
    });
    if (D.folderInput) D.folderInput.addEventListener('change', () => {
      if (D.folderInput.files.length > 0) _handleFolderInput(D.folderInput.files);
    });

    // Deploy mode
    if (D.deployModeSelect) {
      D.deployModeSelect.addEventListener('change', () => {
        state.deployMode = D.deployModeSelect.value;
      });
    }

    // Deploy actions
    D.deployBtn.addEventListener('click', _runDeploy);
    D.clearBtn.addEventListener('click', _clearDeploy);
    D.clearTermBtn.addEventListener('click', () => Terminal.clear());
    D.copyTermBtn.addEventListener('click', () => {
      Terminal.copyAll();
      Notify.toast('Logs copied to clipboard', 'success');
      Notify.playPing();
    });

    // History
    if (D.clearHistoryBtn) D.clearHistoryBtn.addEventListener('click', () => {
      History.clear();
      _renderHistory();
      Notify.toast('History cleared', 'info');
    });

    // Settings
    if (D.settingsBtn) D.settingsBtn.addEventListener('click', () => {
      const on = Notify.toggleSound();
      _updateSoundIcon();
      Notify.toast(`Sound ${on ? 'enabled' : 'disabled'}`, 'info');
      if (on) Notify.playPing();
    });
  }

  /* ════════════════════════════ SHORTCUTS ══ */
  function _registerShortcuts() {
    Shortcuts.bind({ key: 'k', ctrl: true, label: 'Command Palette', category: 'General', handler: () => { if (state.user) Palette.toggle(); } });
    Shortcuts.bind({ key: 'd', ctrl: true, label: 'Deploy Workspace', category: 'Deploy', handler: () => { if (state.user && !D.deployBtn.disabled) _runDeploy(); } });
    Shortcuts.bind({ key: 'Escape', label: 'Close Modal / Palette', category: 'General', handler: () => {
      if (Palette.isVisible()) { Palette.hide(); return; }
      if (state.user) {
        _hideModal(D.createRepoModal);
        if (D.createBranchModal) _hideModal(D.createBranchModal);
      }
    }});
    Shortcuts.bind({ key: 'l', ctrl: true, label: 'Clear Terminal', category: 'Terminal', handler: () => { if (state.user) Terminal.clear(); } });
  }

  function _registerPalette() {
    Palette.register([
      { id: 'deploy',      label: 'Deploy Workspace',        icon: 'rocket',          category: 'Deploy',    shortcut: 'Ctrl+D', handler: () => { if (!D.deployBtn.disabled) _runDeploy(); } },
      { id: 'clear',       label: 'Clear Staged File',       icon: 'x',               category: 'Deploy',    handler: _clearDeploy },
      { id: 'search-repo', label: 'Search Repositories',     icon: 'search',          category: 'Repository', handler: () => { D.repoSearch.focus(); _showDropdown(); } },
      { id: 'new-repo',    label: 'Create New Repository',   icon: 'git-branch-plus', category: 'Repository', handler: () => _showModal(D.createRepoModal, D.newRepoName) },
      { id: 'new-branch',  label: 'Create New Branch',       icon: 'git-branch',      category: 'Repository', handler: () => _showBranchModal() },
      { id: 'setup-repo',  label: 'Setup / Reinstall Pipeline', icon: 'settings-2',   category: 'Repository', handler: () => { if (!D.setupRepoBtn.disabled) _setupRepo(); } },
      { id: 'clear-term',  label: 'Clear Terminal',          icon: 'eraser',          category: 'Terminal',   shortcut: 'Ctrl+L', handler: () => Terminal.clear() },
      { id: 'copy-logs',   label: 'Copy Terminal Logs',      icon: 'clipboard',       category: 'Terminal',   handler: () => { Terminal.copyAll(); Notify.toast('Logs copied', 'success'); } },
      { id: 'toggle-sound',label: 'Toggle Sound',            icon: 'volume-2',        category: 'Settings',   handler: () => { Notify.toggleSound(); _updateSoundIcon(); } },
      { id: 'logout',      label: 'Sign Out',                icon: 'log-out',         category: 'Account',    handler: _logout },
    ]);
  }

  /* ════════════════════════════ AUTH ══ */
  function _startAuth() {
    D.connectBtn.disabled = true;
    D.connectSpinner.classList.remove('hidden');
    D.connectLabel.textContent = 'Redirecting to GitHub…';
    setTimeout(() => Auth.startOAuthRedirect(), 150);
  }

  async function _handleOAuthCallback(code, codeState) {
    D.connectBtn.disabled = true;
    D.connectSpinner.classList.remove('hidden');
    D.connectLabel.textContent = 'Completing sign-in…';
    D.authStatus.textContent  = 'Exchanging authorization code…';
    D.authStatus.style.color  = '';

    try {
      const token = await Auth.exchangeCode(code, codeState);
      D.authStatus.textContent = 'Token received. Loading your profile…';
      API.setToken(token);
      const user = await API.getUser();
      Auth.saveSession(token, user);
      _loginSuccess(user, true);
    } catch (err) {
      D.connectBtn.disabled = false;
      D.connectSpinner.classList.add('hidden');
      D.connectLabel.textContent = 'Connect with GitHub';
      D.authStatus.textContent   = `Sign-in failed: ${err.message}`;
      D.authStatus.style.color   = 'var(--error)';
      Terminal.log(`OAuth callback error: ${err.message}`, 'error', 'er');
    }
  }

  async function _loginSuccess(user, fresh) {
    state.user = user;
    D.loginView.classList.add('hidden');
    D.appView.classList.remove('hidden');
    D.appView.classList.add('fade-in');
    D.userAvatar.src = user.avatar_url;
    D.userName.textContent = user.login;
    lucide.createIcons();
    Terminal.log(`Authenticated as ${user.login}.`, 'success', 'ok');
    if (fresh) {
      Terminal.log('Token saved locally. You will stay logged in.', 'dim');
      Notify.requestPermission();
    }
    _renderHistory();
    await _loadRepos();
  }

  function _logout() {
    Actions.stopWatching();
    Auth.clearSession();
    state = {
      user: null, repos: [], branches: [],
      selectedRepo: null, selectedRepoObj: null, selectedBranch: 'main',
      selectedFile: null, selectedFileBlob: null, isDeploying: false,
      workflowInstalled: false, pipelineVersion: null,
      uploadMode: 'zip', deployMode: 'merge', inspectResult: null,
    };
    D.appView.classList.add('hidden');
    D.appView.classList.remove('fade-in');
    D.loginView.classList.remove('hidden');
    D.connectBtn.disabled = false;
    D.connectSpinner.classList.add('hidden');
    D.connectLabel.textContent = 'Connect with GitHub';
    D.authStatus.textContent = '';
    D.authStatus.style.color = '';
    // Reset UI
    if (D.dashboardPanel) D.dashboardPanel.style.display = 'none';
    if (D.inspectorPanel) D.inspectorPanel.style.display = 'none';
    Notify.toast('Signed out', 'info');
  }

  /* ════════════════════════════ REPOS ══ */
  async function _loadRepos() {
    Terminal.log('Loading repositories…', 'dim');
    _showSkeleton(D.repoDropdown);
    try {
      state.repos = await API.listRepos();
      Terminal.log(`Loaded ${state.repos.length} repositor${state.repos.length === 1 ? 'y' : 'ies'}.`, 'success', 'ok');
      _renderRepoList(state.repos);
    } catch (err) {
      Terminal.log(`Failed to load repositories: ${err.message}`, 'error', 'er');
      _renderRepoList([]);
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
  function _hideDropdown() { D.repoDropdown.classList.add('hidden'); }

  function _filterRepos() {
    const q = D.repoSearch.value.toLowerCase().trim();
    const filtered = q ? state.repos.filter(r => r.full_name.toLowerCase().includes(q)) : state.repos;
    _renderRepoList(filtered);
    _showDropdown();
  }

  async function _selectRepo(repo) {
    state.selectedRepo    = repo.full_name;
    state.workflowInstalled = false;
    state.selectedRepoObj = repo;
    D.repoSearch.value    = repo.full_name;
    _hideDropdown();
    Terminal.log(`Selected: ${repo.full_name}`, 'info', 'in');

    // Load branches + dashboard in parallel
    const branchPromise = _loadBranches(repo.full_name, repo.default_branch);
    const dashPromise = _loadDashboard(repo.full_name, repo.default_branch);
    await Promise.all([branchPromise, dashPromise]);
    _checkReady();
  }

  /* ════════════════════════════ BRANCHES ══ */
  async function _loadBranches(repo, defaultBranch = 'main') {
    D.branchSelect.innerHTML = '<option>Loading…</option>';
    D.branchSelect.disabled = true;
    try {
      state.branches = await API.listBranches(repo);
      D.branchSelect.innerHTML = state.branches
        .map(b => `<option value="${b.name}"${b.name === defaultBranch ? ' selected' : ''}>${b.name}${b.name === defaultBranch ? ' (default)' : ''}</option>`)
        .join('');
      D.branchSelect.disabled = false;
      state.selectedBranch = defaultBranch;
      await _checkWorkflowStatus();
    } catch (err) {
      D.branchSelect.innerHTML = `<option value="${defaultBranch}">${defaultBranch}</option>`;
      D.branchSelect.disabled = false;
      Terminal.log(`Could not load branches: ${err.message}`, 'warn', 'wn');
    }
  }

  /* ════════════════════════════ BRANCH CREATION ══ */
  function _showBranchModal() {
    if (!state.selectedRepo || !D.createBranchModal) return;
    if (D.branchSourceLabel) D.branchSourceLabel.textContent = state.selectedBranch;
    _showModal(D.createBranchModal, D.newBranchName);
  }

  async function _createBranch() {
    if (!D.newBranchName) return;
    const name = D.newBranchName.value.trim();
    if (!name) { D.newBranchName.focus(); return; }

    D.createBranchSubmit.disabled = true;
    D.createBranchSubmit.querySelector('span').textContent = 'Creating…';

    try {
      // Get the SHA of the source branch
      const branchData = await API.getBranchDetails(state.selectedRepo, state.selectedBranch);
      const sha = branchData.commit.sha;
      await API.createBranch(state.selectedRepo, name, sha);
      Terminal.log(`Branch created: ${name} (from ${state.selectedBranch})`, 'success', 'ok');
      Notify.toast(`Branch "${name}" created`, 'success');
      Notify.playPing();
      _hideModal(D.createBranchModal);
      D.newBranchName.value = '';
      // Reload branches and select new one
      await _loadBranches(state.selectedRepo, name);
      state.selectedBranch = name;
    } catch (err) {
      Terminal.log(`Failed to create branch: ${err.message}`, 'error', 'er');
      Notify.toast(`Branch creation failed: ${err.message}`, 'error');
    } finally {
      D.createBranchSubmit.disabled = false;
      D.createBranchSubmit.querySelector('span').textContent = 'Create Branch';
    }
  }

  /* ════════════════════════════ DASHBOARD ══ */
  async function _loadDashboard(repo, branch) {
    if (!D.dashboardPanel || !D.dashboardContent) return;
    D.dashboardPanel.style.display = '';
    _showSkeleton(D.dashboardContent);
    try {
      const data = await Dashboard.load(repo, branch);
      Dashboard.render(D.dashboardContent, data);
    } catch (err) {
      D.dashboardContent.innerHTML = '<div class="dash-error">Failed to load dashboard</div>';
    }
  }

  /* ════════════════════════════ WORKFLOW STATUS ══ */
  async function _checkWorkflowStatus() {
    if (!state.selectedRepo) return;
    _setWorkflowBadge('neutral', 'circle-dashed', 'Checking…');
    D.setupRepoBtn.disabled = true;

    try {
      const versionInfo = await Deploy.checkPipelineVersion(state.selectedRepo, state.selectedBranch);
      state.pipelineVersion = versionInfo;

      if (versionInfo.installed) {
        state.workflowInstalled = true;
        if (versionInfo.current) {
          _setWorkflowBadge('ok', 'circle-check', `✓ Pipeline v${versionInfo.version}`);
          D.setupRepoBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Reinstall';
        } else {
          _setWorkflowBadge('warn', 'triangle-alert',
            `⚠ Pipeline ${versionInfo.version === 'legacy' ? '(legacy)' : `v${versionInfo.version}`} — upgrade available`);
          D.setupRepoBtn.innerHTML = '<i data-lucide="arrow-up-circle"></i> Upgrade Pipeline';
        }
      } else {
        state.workflowInstalled = false;
        _setWorkflowBadge('warn', 'triangle-alert', '⚠ Pipeline not installed — click Setup');
        D.setupRepoBtn.innerHTML = '<i data-lucide="settings-2"></i> Setup Repository';
      }
    } catch {
      _setWorkflowBadge('neutral', 'circle-dashed', 'Could not check pipeline status');
    } finally {
      D.setupRepoBtn.disabled = !state.selectedRepo;
      lucide.createIcons();
      _checkReady();
    }
  }

  function _setWorkflowBadge(cls, icon, text) {
    D.workflowBadge.className = `workflow-badge ${cls}`;
    D.workflowBadge.innerHTML = `<i data-lucide="${icon}"></i>${text}`;
  }

  /* ════════════════════════════ SETUP REPO ══ */
  async function _setupRepo() {
    if (!state.selectedRepo) return;
    D.setupRepoBtn.disabled = true;
    const prevHtml = D.setupRepoBtn.innerHTML;
    D.setupRepoBtn.innerHTML = '<i data-lucide="loader-2" class="spin-icon"></i> Installing…';
    lucide.createIcons();

    try {
      await Deploy.installWorkflow(state.selectedRepo, state.selectedBranch);
      state.workflowInstalled = true;
      _setWorkflowBadge('ok', 'circle-check', `✓ Pipeline v${CONFIG.PIPELINE_VERSION}`);
      D.setupRepoBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Reinstall';
      Notify.toast('Pipeline installed successfully', 'success');
      Notify.playPing();
      _checkReady();
      lucide.createIcons();
    } catch (err) {
      Terminal.log(`Workflow install failed: ${err.message}`, 'error', 'er');
      Notify.toast(`Pipeline install failed`, 'error');
      D.setupRepoBtn.innerHTML = prevHtml;
    } finally {
      D.setupRepoBtn.disabled = false;
      lucide.createIcons();
    }
  }

  /* ════════════════════════════ CREATE REPO ══ */
  async function _createRepo() {
    const name = D.newRepoName.value.trim();
    if (!name) { D.newRepoName.focus(); return; }
    D.createRepoSubmit.disabled = true;
    D.createRepoSubmit.querySelector('span').textContent = 'Creating…';
    try {
      const repo = await API.createRepo(name, D.newRepoDesc.value.trim(), D.newRepoPrivate.checked);
      Terminal.log(`Repository created: ${repo.full_name}`, 'success', 'ok');
      Notify.toast(`Repository "${name}" created`, 'success');
      Notify.playPing();
      _hideModal(D.createRepoModal);
      D.newRepoName.value = '';
      D.newRepoDesc.value = '';
      D.newRepoPrivate.checked = false;
      await new Promise(r => setTimeout(r, 1500));
      await _loadRepos();
      const newRepo = state.repos.find(r => r.full_name === repo.full_name);
      if (newRepo) {
        let attempts = 0;
        while (attempts < 3) {
          try {
            const branches = await API.listBranches(newRepo.full_name);
            if (branches && branches.length > 0) break;
          } catch {}
          attempts++;
          await new Promise(r => setTimeout(r, 1000));
        }
        _selectRepo(newRepo);
      }
    } catch (err) {
      Terminal.log(`Failed to create repository: ${err.message}`, 'error', 'er');
      Notify.toast('Repository creation failed', 'error');
    } finally {
      D.createRepoSubmit.disabled = false;
      D.createRepoSubmit.querySelector('span').textContent = 'Create Repository';
    }
  }

  /* ════════════════════════════ UPLOAD MODES ══ */
  function _setUploadMode(mode) {
    state.uploadMode = mode;
    [D.uploadModeZip, D.uploadModeFiles, D.uploadModeFolder].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    const activeBtn = mode === 'zip' ? D.uploadModeZip : mode === 'files' ? D.uploadModeFiles : D.uploadModeFolder;
    if (activeBtn) activeBtn.classList.add('active');
  }

  function _triggerUpload() {
    if (state.uploadMode === 'folder' && D.folderInput) {
      D.folderInput.click();
    } else if (state.uploadMode === 'files' && D.filesInput) {
      D.filesInput.click();
    } else {
      D.fileInput.click();
    }
  }

  /* ════════════════════════════ FILE HANDLING ══ */
  function _handleZipFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      D.dropzone.className = 'dropzone file-err';
      state.selectedFile = null;
      state.selectedFileBlob = null;
      Terminal.log(`Rejected "${file.name}" — only .zip files accepted in ZIP mode.`, 'error', 'er');
      _checkReady();
      return;
    }
    _stageFile(file, file, file.name, file.size);
  }

  async function _handleMultipleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    Terminal.log(`Bundling ${fileList.length} file${fileList.length > 1 ? 's' : ''} into workspace.zip…`, 'info');
    try {
      const blob = await Inspector.createZipFromFiles(fileList);
      const names = Array.from(fileList).map(f => f.name).join(', ');
      _stageFile(blob, blob, `${fileList.length} files (${_truncateStr(names, 40)})`, blob.size);
      Terminal.log('Files bundled successfully.', 'success', 'ok');
    } catch (err) {
      Terminal.log(`Failed to bundle files: ${err.message}`, 'error', 'er');
      Notify.toast('Failed to bundle files', 'error');
    }
  }

  async function _handleFolderInput(fileList) {
    if (!fileList || fileList.length === 0) return;
    const folderName = fileList[0]?.webkitRelativePath?.split('/')[0] || 'folder';
    Terminal.log(`Zipping folder "${folderName}" (${fileList.length} files)…`, 'info');
    try {
      const blob = await Inspector.createZipFromFolder(fileList);
      _stageFile(blob, blob, `📁 ${folderName} (${fileList.length} files)`, blob.size);
      Terminal.log('Folder zipped successfully.', 'success', 'ok');
    } catch (err) {
      Terminal.log(`Failed to zip folder: ${err.message}`, 'error', 'er');
      Notify.toast('Failed to zip folder', 'error');
    }
  }

  async function _handleDroppedFolder(dataTransfer) {
    // Fallback for drag-and-drop folders — read entries
    const items = dataTransfer.items;
    if (!items) return;
    const files = [];
    const promises = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) promises.push(_readEntry(entry, '', files));
    }
    await Promise.all(promises);
    if (files.length > 0) {
      Terminal.log(`Zipping dropped folder (${files.length} files)…`, 'info');
      try {
        const zip = new JSZip();
        for (const f of files) {
          const data = await f.file.arrayBuffer();
          zip.file(f.path, data);
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        _stageFile(blob, blob, `📁 Dropped folder (${files.length} files)`, blob.size);
        Terminal.log('Folder zipped successfully.', 'success', 'ok');
      } catch (err) {
        Terminal.log(`Failed to zip folder: ${err.message}`, 'error', 'er');
      }
    }
  }

  function _readEntry(entry, basePath, files) {
    return new Promise(async resolve => {
      if (entry.isFile) {
        entry.file(file => {
          files.push({ path: basePath + entry.name, file });
          resolve();
        }, resolve);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readBatch = () => new Promise((res, rej) => reader.readEntries(res, rej));
        const allEntries = [];
        let batch;
        do {
          batch = await readBatch();
          allEntries.push(...batch);
        } while (batch.length > 0);
        for (const e of allEntries) {
          await _readEntry(e, basePath + entry.name + '/', files);
        }
        resolve();
      } else {
        resolve();
      }
    });
  }

  async function _stageFile(displayFile, uploadBlob, displayName, displaySize) {
    const sizeMB = displaySize / 1_048_576;
    if (sizeMB > 90) {
      D.dropzone.className = 'dropzone file-err';
      state.selectedFile = null;
      state.selectedFileBlob = null;
      D.dzFileName.textContent = '';
      D.dzFileMeta.textContent = '';
      Terminal.log(`Rejected: ${sizeMB.toFixed(1)} MB exceeds the 90 MB limit (GitHub Contents API max is 100 MB). Split your workspace into smaller archives.`, 'error', 'er');
      Notify.toast('File too large — 90 MB maximum', 'error');
      _checkReady();
      return;
    }
    if (sizeMB > 50) {
      Terminal.log(`Warning: ${sizeMB.toFixed(1)} MB — large files may be slow or fail.`, 'warn', 'wn');
    }

    D.dropzone.className = 'dropzone has-file';
    state.selectedFile = displayFile;
    state.selectedFileBlob = uploadBlob;
    D.dzFileName.textContent = displayName;
    D.dzFileMeta.textContent = `${_fmtBytes(displaySize)} · will be deployed as workspace.zip`;
    Terminal.log(`Artifact staged: ${displayName} (${_fmtBytes(displaySize)})`, 'success', 'ok');

    // Inspect the zip contents
    try {
      const result = await Inspector.inspect(uploadBlob);
      state.inspectResult = result;
      if (D.inspectorPanel && D.inspectorContent) {
        D.inspectorPanel.style.display = '';
        Inspector.render(D.inspectorContent, result);
      }
      if (result.hasWorkflowFiles) {
        Terminal.log(`Found ${result.workflowFiles.length} workflow file${result.workflowFiles.length > 1 ? 's' : ''} — will push directly via API.`, 'info', 'in');
      }
    } catch {
      // Non-critical — inspection may fail for non-zip blobs
      if (D.inspectorPanel) D.inspectorPanel.style.display = 'none';
    }

    _checkReady();
  }

  /* ════════════════════════════ DEPLOY ══ */
  function _checkReady() {
    D.deployBtn.disabled = !(
      state.selectedRepo && 
      state.selectedFileBlob && 
      !state.isDeploying && 
      state.workflowInstalled
    );
  }

  async function _runDeploy() {
    if (!state.selectedRepo || !state.selectedFileBlob || state.isDeploying) return;

    state.isDeploying = true;
    _setBusy(true);
    Pipeline.reset();
    _setStatus('Deploying', 'live');
    Notify.playDeployStart();

    const commitMsg = D.commitMsgInput ? D.commitMsgInput.value.trim() || CONFIG.DEFAULT_COMMIT_MSG : CONFIG.DEFAULT_COMMIT_MSG;

    // Add history entry
    const historyId = History.add({
      repo: state.selectedRepo,
      branch: state.selectedBranch,
      fileName: D.dzFileName?.textContent || 'workspace.zip',
      fileSize: state.selectedFileBlob.size,
      fileCount: state.inspectResult?.fileCount || 0,
      commitMsg,
      deployMode: state.deployMode,
      status: 'pending',
    });

    const result = await Deploy.run({
      repo:       state.selectedRepo,
      branch:     state.selectedBranch,
      file:       state.selectedFileBlob,
      onProgress: _setProg,
      commitMsg,
      deployMode: state.deployMode,
    });

    state.isDeploying = false;
    _setBusy(false);

    if (result.ok) {
      _setStatus('Complete', 'live');
      Notify.playSuccess();
      Notify.send('Deploy Complete ✓', `Successfully deployed to ${result.repo}`);

      History.update(historyId, { status: 'success', commitSha: result.commitSha });

      if (result.commitSha) {
        Terminal.log(`Commit URL  → https://github.com/${result.repo}/commit/${result.commitSha}`, 'sys');
        Terminal.log(`Actions URL → https://github.com/${result.repo}/actions`, 'sys');

        // Start watching Actions
        Actions.watchRun(result.repo, result.commitSha, (actionsStatus, runData) => {
          History.update(historyId, {
            actionsStatus,
            actionsRunId: runData?.id || null,
          });
          _renderHistory();

          if (actionsStatus === 'success' || actionsStatus === 'completed') {
            Notify.send('Actions Complete ✓', `Pipeline finished successfully for ${result.repo}`);
          } else if (actionsStatus === 'failure') {
            Notify.send('Actions Failed ✗', `Pipeline failed for ${result.repo}`);
            Notify.playFailure();
          }
        });
      }
    } else {
      _setStatus('Failed', 'error');
      Notify.playFailure();
      Notify.send('Deploy Failed ✗', `Deployment to ${state.selectedRepo} failed`);
      History.update(historyId, { status: 'failed' });
      Terminal.log('Deployment terminated. Check credentials and repository permissions.', 'dim');
    }

    _renderHistory();
    setTimeout(() => _setProg(null), 1500);
    _checkReady();
  }

  function _clearDeploy() {
    state.selectedFile = null;
    state.selectedFileBlob = null;
    state.inspectResult = null;
    D.fileInput.value = '';
    if (D.filesInput) D.filesInput.value = '';
    if (D.folderInput) D.folderInput.value = '';
    D.dropzone.className = 'dropzone';
    D.dzFileName.textContent = '';
    D.dzFileMeta.textContent = '';
    if (D.inspectorPanel) D.inspectorPanel.style.display = 'none';
    _setProg(null);
    Pipeline.reset();
    _setStatus('Idle', '');
    _checkReady();
    Terminal.log('Session cleared.', 'dim');
  }

  /* ════════════════════════════ HISTORY ══ */
  function _renderHistory() {
    if (!D.historyList) return;
    History.render(D.historyList, (entry) => {
      // On click — show details in terminal
      Terminal.log(`── Deploy #${entry.id.slice(-6)} ──`, 'sys');
      Terminal.log(`Repo: ${entry.repo} [${entry.branch}]`, 'info');
      Terminal.log(`Status: ${entry.status}  |  Actions: ${entry.actionsStatus || 'n/a'}`, 'info');
      Terminal.log(`SHA: ${entry.commitSha || 'n/a'}  |  Time: ${entry.timestamp}`, 'dim');
      if (entry.commitSha) {
        Terminal.log(`Commit → https://github.com/${entry.repo}/commit/${entry.commitSha}`, 'sys');
      }
      if (entry.actionsRunId) {
        Terminal.log(`Actions → https://github.com/${entry.repo}/actions/runs/${entry.actionsRunId}`, 'sys');
      }
    });
  }

  /* ════════════════════════════ MODALS ══ */
  function _showModal(modal, focusEl) {
    if (!modal) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('open'));
    if (focusEl) setTimeout(() => focusEl.focus(), 100);
  }

  function _hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => modal.classList.add('hidden'), 200);
  }

  /* ════════════════════════════ UI HELPERS ══ */
  function _setBusy(busy) {
    D.deployBtn.disabled = busy;
    D.deploySpinner.classList.toggle('hidden', !busy);
    const icon = D.deployBtn.querySelector('.deploy-icon');
    if (icon) icon.style.display = busy ? 'none' : '';
    D.deployLabel.textContent = busy ? 'Deploying…' : 'Deploy Workspace';
  }

  function _setStatus(label, mode) {
    D.statusLabel.textContent = label;
    D.statusPill.className =
      mode === 'live'  ? 'hpill live'    :
      mode === 'error' ? 'hpill error-s' : 'hpill';
  }

  function _setProg(pct) {
    if (pct === null) { D.progRow.classList.remove('show'); return; }
    D.progRow.classList.add('show');
    D.progFill.style.width  = `${pct}%`;
    D.progLabel.textContent = `${pct}%`;
  }

  function _updateSoundIcon() {
    if (!D.settingsBtn) return;
    const icon = Notify.isSoundOn() ? 'volume-2' : 'volume-x';
    D.settingsBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons({ nodes: [D.settingsBtn] });
  }

  function _showSkeleton(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="skeleton-group">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line"></div>
      </div>
    `;
  }

  function _fmtBytes(b) {
    if (b < 1_024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(2)} MB`;
  }

  function _truncateStr(s, len) {
    if (s.length <= len) return s;
    return s.slice(0, len - 1) + '…';
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
