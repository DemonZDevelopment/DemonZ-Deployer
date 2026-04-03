/**
 * DemonZ Deployer — GitHub Actions Watcher (v3.0.0)
 *
 * Polls GitHub Actions workflow run status after a deploy,
 * providing real-time feedback in the terminal and history.
 */

const Actions = (() => {
  let _pollTimer     = null;
  let _pollStartTime = 0;

  /**
   * Watch for a workflow run triggered by a specific commit.
   * Polls until the run completes or times out.
   *
   * @param {string}   repo        — owner/repo
   * @param {string}   commitSha   — the commit SHA that triggered the workflow
   * @param {Function} onUpdate    — callback(status, runData)
   */
  async function watchRun(repo, commitSha, onUpdate) {
    stopWatching();
    _pollStartTime = Date.now();

    Terminal.log('Watching GitHub Actions pipeline status…', 'dim');

    // Initial delay — give GitHub time to register the run
    await _sleep(3000);

    _poll(repo, commitSha, onUpdate);
  }

  function _poll(repo, commitSha, onUpdate) {
    _pollTimer = setTimeout(async () => {
      // Timeout check
      if (Date.now() - _pollStartTime > CONFIG.ACTIONS_POLL_TIMEOUT) {
        Terminal.log('Actions watcher timed out after 5 minutes. Check GitHub manually.', 'warn', 'wn');
        onUpdate('timeout', null);
        return;
      }

      try {
        const runs = await API.listWorkflowRuns(repo, 5);
        const workflowRuns = runs.workflow_runs || [];

        // Find the run triggered by our commit
        const run = workflowRuns.find(r =>
          r.head_sha === commitSha ||
          r.head_sha?.startsWith(commitSha?.slice(0, 7))
        );

        if (!run) {
          // Not found yet — Actions may still be queuing
          Terminal.log('Waiting for Actions runner to pick up the workflow…', 'dim');
          onUpdate('waiting', null);
          _poll(repo, commitSha, onUpdate);
          return;
        }

        const status = run.status;        // queued, in_progress, completed
        const conclusion = run.conclusion; // null, success, failure, cancelled, skipped

        if (status === 'completed') {
          if (conclusion === 'success') {
            Terminal.log(`Actions pipeline completed successfully. Run #${run.run_number}`, 'success', 'ok');
          } else {
            Terminal.log(`Actions pipeline finished: ${conclusion}. Run #${run.run_number}`, 'error', 'er');
          }

          // Fetch job details
          try {
            const jobsData = await API.getJobsForRun(repo, run.id);
            const jobs = jobsData.jobs || [];
            jobs.forEach(job => {
              const dur = _formatDuration(job.started_at, job.completed_at);
              const icon = job.conclusion === 'success' ? '✓' : '✗';
              Terminal.log(`  ${icon} ${job.name} — ${dur}`, job.conclusion === 'success' ? 'success' : 'error');
            });
          } catch {}

          Terminal.log(`Actions URL → https://github.com/${repo}/actions/runs/${run.id}`, 'sys');
          onUpdate(conclusion || 'completed', run);
          return;
        }

        // Still running
        const statusLabel = status === 'in_progress' ? 'running' : status;
        Terminal.log(`Actions: ${statusLabel}… (Run #${run.run_number})`, 'dim');
        onUpdate(status, run);
        _poll(repo, commitSha, onUpdate);

      } catch (err) {
        // Don't crash the watcher on transient errors
        Terminal.log(`Actions poll error: ${err.message}`, 'warn', 'wn');
        _poll(repo, commitSha, onUpdate);
      }
    }, CONFIG.ACTIONS_POLL_INTERVAL);
  }

  /**
   * Fetch detailed run info (for the history drawer).
   */
  async function fetchRunDetails(repo, runId) {
    try {
      const [run, jobsData] = await Promise.all([
        API.getWorkflowRun(repo, runId),
        API.getJobsForRun(repo, runId),
      ]);
      return {
        run,
        jobs: jobsData.jobs || [],
      };
    } catch (err) {
      throw new Error(`Failed to fetch run details: ${err.message}`);
    }
  }

  function stopWatching() {
    if (_pollTimer) {
      clearTimeout(_pollTimer);
      _pollTimer = null;
    }
  }

  /* ── Helpers ── */
  function _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function _formatDuration(start, end) {
    try {
      if (!start || !end) return '—';
      const ms = new Date(end) - new Date(start);
      const secs = Math.floor(ms / 1000);
      if (secs < 60) return `${secs}s`;
      const mins = Math.floor(secs / 60);
      const remSecs = secs % 60;
      return `${mins}m ${remSecs}s`;
    } catch { return '—'; }
  }

  return { watchRun, stopWatching, fetchRunDetails };
})();
