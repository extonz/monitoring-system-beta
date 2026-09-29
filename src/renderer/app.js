// Guardian — macOS System Settings Architecture Renderer Logic

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  // Sidebar Tabs & Panes
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.settings-pane');
  const incidentBadge = document.getElementById('incident-count-badge');

  // Traffic lights
  const btnClose = document.getElementById('btn-traffic-close');
  const btnMin = document.getElementById('btn-traffic-min');

  // Theme
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');
  const themeLabel = document.getElementById('theme-label');

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

  // Incidents Pane Elements
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
    navItems.forEach(item => {
      const match = item.dataset.tab === tabName;
      item.classList.toggle('active', match);
      item.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });

    if (tabName === 'activity') {
      loadTimeline();
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (btnGotoActivity) btnGotoActivity.addEventListener('click', () => switchTab('activity'));

  // Traffic lights
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (api && api.hideWindow) api.hideWindow();
      else window.close();
    });
  }

  if (btnMin) {
    btnMin.addEventListener('click', () => {
      if (api && api.hideWindow) api.hideWindow();
    });
  }

  // 2. Theme Management
  function initTheme() {
    const saved = localStorage.getItem('guardian-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateTheme(saved);
  }

  function updateTheme(theme) {
    if (theme === 'dark') {
      themeIconSun.style.display = 'block';
      themeIconMoon.style.display = 'none';
      if (themeLabel) themeLabel.textContent = 'Dark Mode';
    } else {
      themeIconSun.style.display = 'none';
      themeIconMoon.style.display = 'block';
      if (themeLabel) themeLabel.textContent = 'Light Mode';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('guardian-theme', next);
      updateTheme(next);
    });
  }

  // 3. State Rendering
  function renderState(state) {
    if (!state) return;

    if (state.monitoredPaths && state.monitoredPaths.length > 0) {
      scopeDisplay.textContent = 'All Local Drives & User Files';
    }

    if (state.state === 'NORMAL') {
      statusHeading.textContent = 'Protected';
      statusSubheading.textContent = 'Behavioral monitoring active across all drives and volumes.';
      statusDot.className = 'status-dot-native green';
      protectionPill.textContent = 'Active';
      protectionPill.className = 'row-pill green';
      if (incidentBadge) incidentBadge.style.display = 'none';
      noIncidentsView.style.display = 'block';
      activeIncidentView.style.display = 'none';
    } else if (state.state === 'OBSERVING') {
      statusHeading.textContent = 'Observing';
      statusSubheading.textContent = 'Elevated background file operations detected.';
      statusDot.className = 'status-dot-native amber';
      protectionPill.textContent = 'Analyzing';
      protectionPill.className = 'row-pill amber';
    } else if (state.state === 'CONTAINED' || state.state === 'CRITICAL' || state.state === 'SUSPICIOUS') {
      statusHeading.textContent = 'Threat Contained';
      statusSubheading.textContent = 'A process was paused to preserve file integrity.';
      statusDot.className = 'status-dot-native amber';
      protectionPill.textContent = 'Intervened';
      protectionPill.className = 'row-pill amber';
      if (incidentBadge) {
        incidentBadge.style.display = 'inline-block';
        incidentBadge.textContent = '1';
      }
      noIncidentsView.style.display = 'none';
      activeIncidentView.style.display = 'block';
    } else if (state.state === 'RECOVERED') {
      statusHeading.textContent = 'Restored';
      statusSubheading.textContent = 'All changed files were verified and recovered.';
      statusDot.className = 'status-dot-native green';
      protectionPill.textContent = 'Clean';
      protectionPill.className = 'row-pill green';
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
      'User data files were targeted.',
      'Executable is unverified.',
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
      activityFeed.innerHTML = '<div class="row"><span class="row-desc">No events recorded.</span></div>';
      return;
    }

    events.slice(0, 3).forEach(evt => {
      const row = document.createElement('div');
      row.className = 'row';

      const isAlert = evt.state === 'CRITICAL' || evt.state === 'CONTAINED' || evt.state === 'SUSPICIOUS';

      row.innerHTML = `
        <div class="row-label-group">
          <span class="row-title">${evt.process ? evt.process.name : evt.title}</span>
          <span class="row-desc">${evt.description ? evt.description.substring(0, 50) : ''}</span>
        </div>
        <span class="row-pill ${isAlert ? 'amber' : 'green'}">${evt.state}</span>
      `;
      activityFeed.appendChild(row);
    });
  }

  async function loadTimeline() {
    timelineList.innerHTML = '<div class="row"><span class="row-desc">Loading log...</span></div>';
    const events = await api.getEvents({ limit: 25 });
    timelineList.innerHTML = '';

    if (!events || events.length === 0) {
      timelineList.innerHTML = '<div class="row"><span class="row-desc">No log entries recorded.</span></div>';
      return;
    }

    events.forEach(e => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="row-label-group">
          <span class="row-title">${e.title}</span>
          <span class="row-desc">${e.description}</span>
        </div>
        <span class="row-value-muted">${e.timeFormatted}</span>
      `;
      timelineList.appendChild(row);
    });
  }

  // 4. Verification Check
  if (btnVerifyDefense) {
    btnVerifyDefense.addEventListener('click', async () => {
      btnVerifyDefense.disabled = true;
      btnVerifyDefense.textContent = 'Checking...';
      await api.runScenario('SETUP_BASELINE');
      await api.runScenario('SUSPICIOUS_BURST');
      btnVerifyDefense.disabled = false;
      btnVerifyDefense.textContent = 'Run Check';
      switchTab('incidents');
    });
  }

  // 5. Recovery & Allow Handlers
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

  // Reactive listeners
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
