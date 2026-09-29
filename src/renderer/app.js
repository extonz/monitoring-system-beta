// Guardian — Apple macOS Style Renderer Logic

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  // View Containers
  const viewDashboard = document.getElementById('view-dashboard');
  const viewIncident = document.getElementById('view-incident');
  const viewTimeline = document.getElementById('view-timeline');

  // Titlebar controls
  const btnCloseWindow = document.getElementById('btn-close-window');
  const btnQuickTest = document.getElementById('btn-quick-test');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');

  // Hero Status
  const statusGlyphWrap = document.getElementById('status-glyph-wrap');
  const statusSvg = document.getElementById('status-svg');
  const statusHeading = document.getElementById('status-heading');
  const statusSubheading = document.getElementById('status-subheading');
  const protectionLabel = document.getElementById('protection-label');
  const scopeDisplay = document.getElementById('scope-display');

  // Quick Incident Banner
  const quickIncidentBar = document.getElementById('quick-incident-bar');
  const qibTitle = document.getElementById('qib-title');
  const qibSub = document.getElementById('qib-sub');
  const btnViewIncidentPane = document.getElementById('btn-view-incident-pane');

  // Recent Activity Feed
  const activityFeed = document.getElementById('activity-feed');
  const btnShowTimeline = document.getElementById('btn-show-timeline');
  const btnSimTamper = document.getElementById('btn-sim-tamper');

  // Incident View
  const btnBackToDash = document.getElementById('btn-back-to-dash');
  const incTitle = document.getElementById('inc-title');
  const incDesc = document.getElementById('inc-desc');
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

  // Timeline View
  const btnBackFromTimeline = document.getElementById('btn-back-from-timeline');
  const timelineList = document.getElementById('timeline-list');

  // Navigation
  function showView(viewName) {
    [viewDashboard, viewIncident, viewTimeline].forEach(v => v.classList.remove('active'));
    if (viewName === 'incident') viewIncident.classList.add('active');
    else if (viewName === 'timeline') {
      viewTimeline.classList.add('active');
      loadTimeline();
    } else {
      viewDashboard.classList.add('active');
    }
  }

  btnBackToDash.addEventListener('click', () => showView('dashboard'));
  btnBackFromTimeline.addEventListener('click', () => showView('dashboard'));
  btnShowTimeline.addEventListener('click', () => showView('timeline'));
  btnViewIncidentPane.addEventListener('click', () => showView('incident'));

  // Close to tray
  btnCloseWindow.addEventListener('click', () => {
    if (api && api.hideWindow) api.hideWindow();
    else window.close();
  });

  // Appearance Theme
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

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('guardian-theme', next);
    updateThemeIcons(next);
  });

  // State Rendering
  function renderState(state) {
    if (!state) return;

    if (state.monitoredPaths && state.monitoredPaths.length > 0) {
      scopeDisplay.textContent = 'All Drives & User Folders';
    }

    if (state.state === 'NORMAL') {
      statusHeading.textContent = 'Your Computer is Protected';
      statusSubheading.textContent = 'Continuous behavioral monitoring is active.';
      protectionLabel.textContent = 'Active';
      protectionLabel.className = 'mac-row-value-green';
      statusGlyphWrap.className = 'mac-status-badge';
      statusSvg.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
      quickIncidentBar.style.display = 'none';
    } else if (state.state === 'OBSERVING') {
      statusHeading.textContent = 'Monitoring Activity';
      statusSubheading.textContent = 'Observing file operation patterns.';
      protectionLabel.textContent = 'Observing';
      protectionLabel.className = 'mac-row-value-amber';
      quickIncidentBar.style.display = 'none';
    } else if (state.state === 'CONTAINED' || state.state === 'CRITICAL' || state.state === 'SUSPICIOUS') {
      statusHeading.textContent = 'Suspicious Activity Paused';
      statusSubheading.textContent = 'A process was paused to preserve file integrity.';
      protectionLabel.textContent = 'Intervened';
      protectionLabel.className = 'mac-row-value-amber';
      statusGlyphWrap.className = 'mac-status-badge alert';
      statusSvg.innerHTML = '<line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
      quickIncidentBar.style.display = 'flex';
    } else if (state.state === 'RECOVERED') {
      statusHeading.textContent = 'System Restored';
      statusSubheading.textContent = 'All changed files were verified and recovered.';
      protectionLabel.textContent = 'Restored';
      protectionLabel.className = 'mac-row-value-green';
      statusGlyphWrap.className = 'mac-status-badge';
      statusSvg.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
      quickIncidentBar.style.display = 'none';
    }

    if (state.activeIncident) {
      renderIncident(state.activeIncident);
    }

    renderFeed(state.recentEvents || []);
  }

  function renderIncident(inc) {
    if (!inc) return;
    const diff = inc.diff || { modified: [], deleted: [] };
    const proc = inc.process || { name: 'unknown_payload.exe', pid: 'N/A', path: 'C:\\Temp\\unknown.exe' };

    incProcTag.textContent = proc.name;
    qibTitle.textContent = `${proc.name} paused`;
    metricModified.textContent = diff.modified ? diff.modified.length : 0;
    metricDeleted.textContent = diff.deleted ? diff.deleted.length : 0;
    metricStatus.textContent = inc.status || 'Paused';

    incReasons.innerHTML = '';
    const reasons = (inc.evaluation && inc.evaluation.reasons) || [
      'Modification rate significantly higher than baseline.',
      'User document directories were targeted.',
      'Executable binary is unverified.',
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
      btnIncidentRecover.textContent = 'Restore Previous Files';
    }
  }

  function renderFeed(events) {
    activityFeed.innerHTML = '';
    if (events.length === 0) {
      activityFeed.innerHTML = '<div style="font-size:11.5px; color:var(--text-tertiary); text-align:center; padding:10px;">Monitoring active. No unusual events.</div>';
      return;
    }

    events.slice(0, 4).forEach(evt => {
      const row = document.createElement('div');
      row.className = 'mac-feed-item';

      const isAlert = evt.state === 'CRITICAL' || evt.state === 'CONTAINED' || evt.state === 'SUSPICIOUS';

      row.innerHTML = `
        <div class="mac-feed-left">
          <span class="mac-dot ${isAlert ? 'alert' : ''}"></span>
          <span class="mac-feed-name">${evt.process ? evt.process.name : evt.title}</span>
        </div>
        <span class="mac-feed-time">${evt.timeFormatted}</span>
      `;
      activityFeed.appendChild(row);
    });
  }

  async function loadTimeline() {
    timelineList.innerHTML = '<div style="font-size:11px; color:var(--text-tertiary); padding:10px;">Loading timeline...</div>';
    const events = await api.getEvents({ limit: 20 });
    timelineList.innerHTML = '';

    if (!events || events.length === 0) {
      timelineList.innerHTML = '<div style="font-size:11px; color:var(--text-tertiary); padding:10px;">No timeline entries recorded.</div>';
      return;
    }

    events.forEach(e => {
      const item = document.createElement('div');
      item.className = 'mac-tl-item';
      item.innerHTML = `
        <div class="mac-tl-top">
          <span class="mac-tl-title">${e.title}</span>
          <span class="mac-tl-time">${e.timeFormatted}</span>
        </div>
        <div class="mac-tl-desc">${e.description}</div>
      `;
      timelineList.appendChild(item);
    });
  }

  // Simulation & Actions
  async function triggerSimulation() {
    btnSimTamper.disabled = true;
    btnSimTamper.textContent = 'Simulating...';
    await api.runScenario('SETUP_BASELINE');
    await api.runScenario('SUSPICIOUS_BURST');
    btnSimTamper.disabled = false;
    btnSimTamper.textContent = 'Test Behavioral Airbag';
    showView('incident');
  }

  btnSimTamper.addEventListener('click', triggerSimulation);
  btnQuickTest.addEventListener('click', triggerSimulation);

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

  btnIncidentAllow.addEventListener('click', async () => {
    await api.allowActivity();
    showView('dashboard');
  });

  api.onStateChanged((state) => renderState(state));

  if (api.onNavigate) {
    api.onNavigate((view) => showView(view));
  }

  initTheme();
  const initial = await api.getState();
  renderState(initial);
});
