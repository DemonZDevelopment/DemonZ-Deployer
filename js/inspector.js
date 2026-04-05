/**
 * DemonZ Deployer — ZIP Inspector & Multi-Format Upload (v3.0.0)
 *
 * Uses JSZip (CDN) to:
 * - Inspect ZIP contents before deploy
 * - Create ZIPs from folders or individual files
 * - Detect workflow files for smart pre-push
 */

const Inspector = (() => {

  /**
   * Helper: Mirrors the GitHub Actions backend logic. 
   * Detects if the ZIP has a single root directory.
   */
  function _getSingleRoot(zipFiles) {
    const topLevelEntries = new Set();
    Object.keys(zipFiles).forEach(path => {
      const parts = path.split('/');
      // If it has a slash, it's in a folder. If no slash, check if it's a file.
      if (parts.length > 1) {
        topLevelEntries.add(parts[0]);
      } else if (!zipFiles[path].dir) {
        topLevelEntries.add('__ROOT_FILE__');
      }
    });
    
    if (topLevelEntries.size === 1 && !topLevelEntries.has('__ROOT_FILE__')) {
      const root = Array.from(topLevelEntries)[0];
      // CRITICAL FIX: Never flatten the .github directory!
      if (root.toLowerCase() === '.github') return null;
      return root + '/';
    }
    return null;
  }

  /**
   * Inspect a ZIP file and return its contents analysis.
   */
  async function inspect(file) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip library not loaded.');

    const zip = await JSZip.loadAsync(file).catch(err => {
      throw new Error(`Failed to read ZIP: ${err.message}`);
    });

    const files = [];
    const workflowFiles = [];
    let totalSize = 0;
    
    const rootToFlatten = _getSingleRoot(zip.files);

    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;

      const size = entry._data?.uncompressedSize || 0;
      totalSize += size;

      let actualPath = relativePath;
      if (rootToFlatten && actualPath.startsWith(rootToFlatten)) {
        actualPath = actualPath.substring(rootToFlatten.length);
      }

      const info = {
        path: actualPath,
        name: actualPath.split('/').pop(),
        size,
        isWorkflow: /(?:^|\/)\.github\/workflows\/.*\.ya?ml$/i.test(actualPath),
      };

      files.push(info);
      if (info.isWorkflow) workflowFiles.push(info);
    });

    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
      files,
      workflowFiles,
      totalSize,
      fileCount: files.length,
      hasWorkflowFiles: workflowFiles.length > 0,
    };
  }

  /**
   * Create a ZIP blob from a FileList (single or multiple files).
   */
  async function createZipFromFiles(fileList) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip library not loaded.');

    const zip = new JSZip();
    for (const file of fileList) {
      const data = await file.arrayBuffer();
      zip.file(file.name, data);
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  /**
   * Create a ZIP blob from folder entries (from webkitdirectory input).
   */
  async function createZipFromFolder(fileList) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip library not loaded.');

    const zip = new JSZip();
    for (const file of fileList) {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');
      let relativePath = path;
      
      // CRITICAL FIX: Only flatten if the root folder is NOT .github
      if (parts.length > 1 && parts[0].toLowerCase() !== '.github') {
        relativePath = parts.slice(1).join('/');
      }
      
      const data = await file.arrayBuffer();
      zip.file(relativePath, data);
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  /**
   * Extract workflow file contents from a ZIP for direct API push.
   */
  async function extractWorkflowFiles(file) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip library not loaded.');

    const zip = await JSZip.loadAsync(file);
    const results = [];
    const rootToFlatten = _getSingleRoot(zip.files);

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      
      let actualPath = path;
      if (rootToFlatten && actualPath.startsWith(rootToFlatten)) {
        actualPath = actualPath.substring(rootToFlatten.length);
      }

      if (/(?:^|\/)\.github\/workflows\/.*\.ya?ml$/i.test(actualPath)) {
        const content = await entry.async('base64');
        results.push({ path: actualPath, contentBase64: content });
      }
    }

    return results;
  }

  /**
   * Render file tree into container.
   */
  function render(container, result) {
    container.innerHTML = '';

    if (!result || result.fileCount === 0) {
      container.innerHTML = '<div class="inspector-empty">No files in archive</div>';
      return;
    }

    const tree = {};
    result.files.forEach(f => {
      const parts = f.path.split('/');
      let node = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          if (!node.__files) node.__files = [];
          node.__files.push(f);
        } else {
          if (!node[part]) node[part] = {};
          node = node[part];
        }
      });
    });

    const statsHtml = `
      <div class="inspector-stats">
        <span class="inspector-stat"><i data-lucide="file" class="inspector-stat-icon"></i>${result.fileCount} files</span>
        <span class="inspector-stat"><i data-lucide="hard-drive" class="inspector-stat-icon"></i>${_fmtBytes(result.totalSize)}</span>
        ${result.hasWorkflowFiles
          ? `<span class="inspector-stat wf"><i data-lucide="settings-2" class="inspector-stat-icon"></i>${result.workflowFiles.length} workflow file${result.workflowFiles.length > 1 ? 's' : ''} (direct push)</span>`
          : ''}
      </div>
    `;

    const treeHtml = _renderNode(tree, '');

    container.innerHTML = statsHtml + `<div class="inspector-tree">${treeHtml}</div>`;

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });

    container.querySelectorAll('.inspector-folder-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.inspector-folder');
        parent.classList.toggle('collapsed');
      });
    });
  }

  function _renderNode(node, prefix) {
    let html = '';

    const dirs = Object.keys(node).filter(k => k !== '__files').sort();
    dirs.forEach(dir => {
      const childCount = _countFiles(node[dir]);
      html += `
        <div class="inspector-folder">
          <div class="inspector-folder-toggle">
            <i data-lucide="chevron-down" class="inspector-chevron"></i>
            <i data-lucide="folder" class="inspector-folder-icon"></i>
            <span class="inspector-folder-name">${_esc(dir)}</span>
            <span class="inspector-folder-count">${childCount}</span>
          </div>
          <div class="inspector-folder-children">
            ${_renderNode(node[dir], prefix + dir + '/')}
          </div>
        </div>
      `;
    });

    const files = node.__files || [];
    files.forEach(f => {
      const sizeClass = f.size > 10_000_000 ? 'size-danger' :
                        f.size > 1_000_000  ? 'size-warn' : '';
      const wfBadge = f.isWorkflow
        ? '<span class="inspector-wf-badge">⚙ workflow</span>'
        : '';

      html += `
        <div class="inspector-file">
          <i data-lucide="file-text" class="inspector-file-icon"></i>
          <span class="inspector-file-name">${_esc(f.name)}</span>
          ${wfBadge}
          <span class="inspector-file-size ${sizeClass}">${_fmtBytes(f.size)}</span>
        </div>
      `;
    });

    return html;
  }

  function _countFiles(node) {
    let count = (node.__files || []).length;
    Object.keys(node).filter(k => k !== '__files').forEach(k => {
      count += _countFiles(node[k]);
    });
    return count;
  }

  function _fmtBytes(b) {
    if (b < 1_024)       return `${b} B`;
    if (b < 1_048_576)   return `${(b / 1_024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(2)} MB`;
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { inspect, render, createZipFromFiles, createZipFromFolder, extractWorkflowFiles };
})();
