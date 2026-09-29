// Guardian — Custom Precision Desktop Security Renderer Logic

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  // Window Controls
  const btnWindowClose = document.getElementById('btn-window-close');
  const btnWindowMin = document.getElementById('btn-window-min');
  const btnQuickTest = document.getElementById('btn-quick-test');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');

  // Navigation
  const navButtons = document.querySelectorAll('.nav-button');
  const panes = document.querySelectorAll('.content-pane');
  const incidentBadge = document.getElementById('incident-count-badge');

  // Protection Pane Elements
  const statusHeading = document.getElementById('status-heading');
  const statusSubheading = document.getElementById('status-subheading');
  const statusDot = document.getElementById('status-dot');
  const toggleProtection = document.getElementById('toggle-protection');
  const scopeDisplay = document.getElementById('scope-display');
  const protectionPill = document.getElementById('protection-pill');
  const activityFeed = document.getElementById('activity-feed');
  const btnGotoActivity = document.getElementById('btn-goto-activity');
  const btnVerifyDefense = document.getElementById('btn-verify-defense');

  // Quarantine Pane Elements
  const noIncidentsView = document.getElementById('no-incidents-view');
  const activeIncidentView = document.getElementById('active-incident-view');
  const incProcTag = document.getElementById('inc-proc-tag');
  const metricModified = document.getElementById('metric-modified');
  const metricDeleted = document.getElementById('metric-deleted');
  const metricStatus = document.getElementById('metric-status');
  const incReasons = document.getElementById('inc-reasons');
  const btnIncidentRecover = document.getElementById('btn-incident-recover');
  const btnIncidentAllow = document.getElementById('btn-incident-allow');
  const incRecoveryProgress = document.getElementById('inc-recovery-progress');
  const incProgressBar = document.getElementById('inc-progress-bar');
  const incProgressCounter = document.getElementById('inc-progress-counter');
  const fPath = document.getElementById('f-path');
  const fPid = document.getElementById('f-pid');
  const fSig = document.getElementById('f-sig');
  const fHash = document.getElementById('f-hash');

  // Timeline
  const timelineList = document.getElementById('timeline-list');

  // 1. Navigation
  function switchTab(tabName) {
    navButtons.forEach(btn => {
      const match = btn.dataset.tab === tabName;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });

    if (tabName === 'activity') {
      loadTimeline();
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (btnGotoActivity) btnGotoActivity.addEventListener('click', () => switchTab('activity'));

  // Window Controls (Hide/Minimize to Tray)
  if (btnWindowClose) {
    btnWindowClose.addEventListener('click', () => {
      if (api && api.hideWindow) api.hideWindow();
      else window.close();
    });
  }

  if (btnWindowMin) {
    btnWindowMin.addEventListener('click', () => {
      if (api && api.hideWindow) api.hideWindow();
    });
  }

  // 2. Theme Management
  function initTheme() {
    const saved = localStorage.getItem('guardian-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcons(saved);
  }

  function updateThemeIcons(theme) {
    if (theme === 'dark') {
      themeIconSun.style.display = 'block';
      themeIconMoon.style.display = 'none';
    } else {
      themeIconSun.style.display = 'none';
      themeIconMoon.style.display = 'block';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('guardian-theme', next);
      updateThemeIcons(next);
    });
  }

  // 3. State Rendering
  function renderState(state) {
    if (!state) return;

    if (state.monitoredPaths && state.monitoredPaths.length > 0) {
      scopeDisplay.textContent = 'All Local Drives & User Files';
    }

    if (state.state === 'NORMAL') {
      statusHeading.textContent = 'Active';
      statusSubheading.textContent = 'Continuous behavioral defense across all local storage.';
      statusDot.className = 'chip-dot';
      protectionPill.textContent = 'Active';
      protectionPill.className = 'status-tag green';
      if (incidentBadge) incidentBadge.style.display = 'none';
      noIncidentsView.style.display = 'block';
      activeIncidentView.style.display = 'none';
    } else if (state.state === 'OBSERVING') {
      statusHeading.textContent = 'Observing';
      statusSubheading.textContent = 'Elevated background file operations detected.';
      statusDot.className = 'chip-dot amber';
      protectionPill.textContent = 'Analyzing';
      protectionPill.className = 'status-tag amber';
    } else if (state.state === 'CONTAINED' || state.state === 'CRITICAL' || state.state === 'SUSPICIOUS') {
      statusHeading.textContent = 'Intervened';
      statusSubheading.textContent = 'A process was paused to preserve file integrity.';
      statusDot.className = 'chip-dot amber';
      protectionPill.textContent = 'Threat Contained';
      protectionPill.className = 'status-tag red';
      if (incidentBadge) {
        incidentBadge.style.display = 'inline-block';
        incidentBadge.textContent = '1';
      }
      noIncidentsView.style.display = 'none';
      activeIncidentView.style.display = 'block';
    } else if (state.state === 'RECOVERED') {
      statusHeading.textContent = 'Restored';
      statusSubheading.textContent = 'All changed files were verified and recovered.';
      statusDot.className = 'chip-dot';
      protectionPill.textContent = 'Clean';
      protectionPill.className = 'status-tag green';
      if (incidentBadge) incidentBadge.style.display = 'none';
      noIncidentsView.style.display = 'block';
      activeIncidentView.style.display = 'none';
    }

    if (state.activeIncident) {
      renderIncident(state.activeIncident);
    }

    renderFeed(state.recentEvents || []);
  }

  function renderIncident(inc) {
    if (!inc) return;
    const diff = inc.diff || { modified: [], deleted: [] };
    const proc = inc.process || { name: 'unknown_payload.exe', pid: 'N/A', path: 'C:\\ProgramData\\unknown.exe' };

    incProcTag.textContent = proc.name;
    metricModified.textContent = `${diff.modified ? diff.modified.length : 0} files`;
    metricDeleted.textContent = `${diff.deleted ? diff.deleted.length : 0} files`;
    metricStatus.textContent = inc.status || 'Suspended';

    incReasons.innerHTML = '';
    const reasons = (inc.evaluation && inc.evaluation.reasons) || [
      'Modification rate was unusually high.',
      'Protected user document storage was targeted.',
      'Binary signature is unverified.',
    ];
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      incReasons.appendChild(li);
    });

    fPath.textContent = proc.path || proc.name;
    fPid.textContent = proc.pid || 'N/A';
    fSig.textContent = proc.signature || 'Unverified';
    fHash.textContent = proc.hash || 'N/A';

    if (inc.recovered) {
      btnIncidentRecover.disabled = true;
      btnIncidentRecover.textContent = 'Files Successfully Restored';
    } else {
      btnIncidentRecover.disabled = false;
      btnIncidentRecover.textContent = 'Restore Files';
    }
  }

  function renderFeed(events) {
    activityFeed.innerHTML = '';
    if (!events || events.length === 0) {
      activityFeed.innerHTML = '<div class="surface-row"><span class="row-sub">No recent events recorded.</span></div>';
      return;
    }

    events.slice(0, 3).forEach(evt => {
      const row = document.createElement('div');
      row.className = 'surface-row';

      const isAlert = evt.state === 'CRITICAL' || evt.state === 'CONTAINED' || evt.state === 'SUSPICIOUS';

      row.innerHTML = `
        <div class="row-info">
          <span class="row-main">${evt.process ? evt.process.name : evt.title}</span>
          <span class="row-sub">${evt.description ? evt.description.substring(0, 48) : ''}</span>
        </div>
        <span class="status-tag ${isAlert ? 'amber' : 'green'}">${evt.state}</span>
      `;
      activityFeed.appendChild(row);
    });
  }

  async function loadTimeline() {
    timelineList.innerHTML = '<div class="surface-row"><span class="row-sub">Loading activity log...</span></div>';
    const events = await api.getEvents({ limit: 25 });
    timelineList.innerHTML = '';

    if (!events || events.length === 0) {
      timelineList.innerHTML = '<div class="surface-row"><span class="row-sub">No log entries recorded.</span></div>';
      return;
    }

    events.forEach(e => {
      const row = document.createElement('div');
      row.className = 'surface-row';
      row.innerHTML = `
        <div class="row-info">
          <span class="row-main">${e.title}</span>
          <span class="row-sub">${e.description}</span>
        </div>
        <span class="row-aux">${e.timeFormatted}</span>
      `;
      timelineList.appendChild(row);
    });
  }

  // Diagnostic Defense Verification
  async function triggerVerification() {
    if (btnVerifyDefense) {
      btnVerifyDefense.disabled = true;
      btnVerifyDefense.textContent = 'Checking...';
      await api.runScenario('SETUP_BASELINE');
      await api.runScenario('SUSPICIOUS_BURST');
      btnVerifyDefense.disabled = false;
      btnVerifyDefense.textContent = 'Run Check';
      switchTab('incidents');
    }
  }

  if (btnVerifyDefense) btnVerifyDefense.addEventListener('click', triggerVerification);
  if (btnQuickTest) btnQuickTest.addEventListener('click', triggerVerification);

  // Recovery & Allow Handlers
  if (btnIncidentRecover) {
    btnIncidentRecover.addEventListener('click', async () => {
      incRecoveryProgress.style.display = 'block';
      incProgressBar.style.width = '30%';
      incProgressCounter.textContent = 'Restoring...';

      const res = await api.executeRecovery();
      incProgressBar.style.width = '100%';
      incProgressCounter.textContent = `${res.totalRestored} restored`;

      setTimeout(() => {
        incRecoveryProgress.style.display = 'none';
        btnIncidentRecover.disabled = true;
        btnIncidentRecover.textContent = 'Files Successfully Restored';
      }, 400);
    });
  }

  if (btnIncidentAllow) {
    btnIncidentAllow.addEventListener('click', async () => {
      await api.allowActivity();
      switchTab('protection');
    });
  }

  if (toggleProtection) {
    toggleProtection.addEventListener('change', async (e) => {
      if (e.target.checked) await api.startMonitoring();
      else await api.stopMonitoring();
    });
  }

  api.onStateChanged((state) => renderState(state));

  if (api.onNavigate) {
    api.onNavigate((view) => {
      if (view === 'incident' || view === 'incidents') switchTab('incidents');
      else switchTab(view);
    });
  }

  initTheme();
  const initial = await api.getState();
  renderState(initial);
});
