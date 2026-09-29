// Guardian Renderer Application Logic

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  // DOM Elements
  const tabs = document.querySelectorAll('.nav-btn');
  const panes = document.querySelectorAll('.tab-pane');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');

  // Dashboard Status Elements
  const statusDot = document.getElementById('status-dot');
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  const statusTag = document.getElementById('status-tag');
  const monitoredPathDisplay = document.getElementById('monitored-path-display');
  const suspendedCountDisplay = document.getElementById('suspended-count-display');
  const incidentBanner = document.getElementById('incident-banner');
  const bannerViewBtn = document.getElementById('banner-view-btn');
  const navIncidentBtn = document.getElementById('nav-incident-btn');
  const incidentIndicator = document.getElementById('incident-indicator');
  const dashboardRecentList = document.getElementById('dashboard-recent-list');

  // Incident Screen Elements
  const noIncidentState = document.getElementById('no-incident-state');
  const incidentDetailState = document.getElementById('incident-detail-state');
  const incStatModified = document.getElementById('inc-stat-modified');
  const incStatDeleted = document.getElementById('inc-stat-deleted');
  const incStatCreated = document.getElementById('inc-stat-created');
  const incReasonsList = document.getElementById('inc-reasons-list');
  const ffProcName = document.getElementById('ff-proc-name');
  const ffPid = document.getElementById('ff-pid');
  const ffPath = document.getElementById('ff-path');
  const ffSignature = document.getElementById('ff-signature');
  const ffHash = document.getElementById('ff-hash');
  const ffSignals = document.getElementById('ff-signals');

  const btnRecoverMain = document.getElementById('btn-recover-main');
  const btnAllowActivity = document.getElementById('btn-allow-activity');
  const recoveryProgressBox = document.getElementById('recovery-progress-container');
  const recoveryProgressBar = document.getElementById('recovery-progress-bar');
  const recoveryProgressCounter = document.getElementById('recovery-progress-counter');
  const recoverySuccessBox = document.getElementById('recovery-success-box');
  const recoverySuccessText = document.getElementById('recovery-success-text');

  // Timeline Elements
  const timelineEntries = document.getElementById('timeline-entries');
  const filterPills = document.querySelectorAll('#timeline-filters .pill');

  // Demo Controls
  const btnDemoBaseline = document.getElementById('btn-demo-baseline');
  const btnDemoNormal = document.getElementById('btn-demo-normal');
  const btnDemoSuspicious = document.getElementById('btn-demo-suspicious');
  const btnChangeFolder = document.getElementById('btn-change-folder');
  const btnRebaseline = document.getElementById('btn-rebaseline');
  const btnGotoDemo = document.getElementById('btn-goto-demo');
  const linkViewAllActivity = document.getElementById('link-view-all-activity');

  let currentTimelineFilter = 'ALL';
  let currentState = null;

  // 1. Tab Navigation
  function switchTab(tabId) {
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    panes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
    if (tabId === 'timeline') {
      loadTimeline();
    }
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (bannerViewBtn) bannerViewBtn.addEventListener('click', () => switchTab('incident'));
  if (btnGotoDemo) btnGotoDemo.addEventListener('click', () => switchTab('demo'));
  if (linkViewAllActivity) linkViewAllActivity.addEventListener('click', () => switchTab('timeline'));

  // 2. Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('guardian-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
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
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('guardian-theme', next);
    updateThemeIcons(next);
  });

  // 3. UI State Rendering
  function renderState(state) {
    currentState = state;
    if (!state) return;

    // Monitored path
    if (state.monitoredDir) {
      monitoredPathDisplay.textContent = state.monitoredDir;
    }

    if (suspendedCountDisplay) {
      suspendedCountDisplay.textContent = `${state.suspendedCount || 0} paused`;
    }

    // Hero Status mapping
    statusDot.className = 'status-dot';
    statusDot.classList.add(state.state.toLowerCase());
    statusTag.textContent = state.state;

    switch (state.state) {
      case 'NORMAL':
        statusTitle.textContent = 'Everything looks good';
        statusDesc.textContent = 'No unusual activity detected. Behavioral monitoring is active.';
        statusTag.style.color = 'var(--color-success)';
        statusTag.style.backgroundColor = 'var(--color-success-bg)';
        incidentBanner.style.display = 'none';
        incidentIndicator.style.display = 'none';
        break;
      case 'OBSERVING':
        statusTitle.textContent = 'Monitoring unusual activity';
        statusDesc.textContent = 'Slightly elevated operations observed. Guardian is passively analyzing patterns.';
        statusTag.style.color = 'var(--color-warning)';
        statusTag.style.backgroundColor = 'var(--color-warning-bg)';
        incidentBanner.style.display = 'none';
        incidentIndicator.style.display = 'none';
        break;
      case 'SUSPICIOUS':
        statusTitle.textContent = 'Unusual activity detected';
        statusDesc.textContent = 'A process is exhibiting high-frequency file modifications.';
        statusTag.style.color = 'var(--color-warning)';
        statusTag.style.backgroundColor = 'var(--color-warning-bg)';
        incidentBanner.style.display = 'flex';
        incidentIndicator.style.display = 'inline-block';
        break;
      case 'CONTAINED':
        statusTitle.textContent = 'Activity paused';
        statusDesc.textContent = 'A suspicious process was paused to protect your files from damage.';
        statusTag.style.color = 'var(--color-danger)';
        statusTag.style.backgroundColor = 'var(--color-danger-bg)';
        incidentBanner.style.display = 'flex';
        incidentIndicator.style.display = 'inline-block';
        break;
      case 'RECOVERING':
        statusTitle.textContent = 'Recovering your system';
        statusDesc.textContent = 'Reverting unauthorized changes and restoring baseline files...';
        statusTag.style.color = 'var(--color-primary)';
        statusTag.style.backgroundColor = 'var(--color-info-bg)';
        break;
      case 'RECOVERED':
        statusTitle.textContent = 'System recovered';
        statusDesc.textContent = 'The detected changes were successfully reversed and verified.';
        statusTag.style.color = 'var(--color-success)';
        statusTag.style.backgroundColor = 'var(--color-success-bg)';
        incidentBanner.style.display = 'none';
        incidentIndicator.style.display = 'none';
        break;
    }

    // Render Incident Details
    renderIncidentView(state.activeIncident);

    // Render Dashboard Activity Feed
    renderRecentFeed(state.recentEvents || []);
  }

  function renderIncidentView(incident) {
    if (!incident) {
      noIncidentState.style.display = 'block';
      incidentDetailState.style.display = 'none';
      return;
    }

    noIncidentState.style.display = 'none';
    incidentDetailState.style.display = 'block';

    const diff = incident.diff || { modified: [], deleted: [], created: [] };
    incStatModified.textContent = diff.modified ? diff.modified.length : 0;
    incStatDeleted.textContent = diff.deleted ? diff.deleted.length : 0;
    incStatCreated.textContent = diff.created ? diff.created.length : 0;

    // Reasons
    incReasonsList.innerHTML = '';
    const reasons = (incident.evaluation && incident.evaluation.reasons) || [
      'The modification rate was significantly higher than normal.',
      'User data files were directly modified.',
      'Process is unverified or unsigned.',
    ];
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      incReasonsList.appendChild(li);
    });

    // Forensic specs
    const proc = incident.process || {};
    ffProcName.textContent = proc.name || 'unknown.exe';
    ffPid.textContent = proc.pid || 'N/A';
    ffPath.textContent = proc.path || 'Unknown path';
    ffSignature.textContent = proc.signature || 'Unsigned';
    ffHash.textContent = proc.hash || 'N/A';
    ffSignals.textContent = (incident.evaluation && incident.evaluation.signals) ? incident.evaluation.signals.join(', ') : 'none';

    // Recovery status alerts
    if (incident.recovered) {
      recoverySuccessBox.style.display = 'flex';
      recoveryProgressBox.style.display = 'none';
      btnRecoverMain.disabled = true;
      btnRecoverMain.innerHTML = '✓ System Recovered';
    } else {
      recoverySuccessBox.style.display = 'none';
      btnRecoverMain.disabled = false;
      btnRecoverMain.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg> Restore System State`;
    }
  }

  function renderRecentFeed(events) {
    dashboardRecentList.innerHTML = '';
    if (events.length === 0) {
      dashboardRecentList.innerHTML = '<div class="card-hint">No recent events recorded.</div>';
      return;
    }

    events.slice(0, 5).forEach(evt => {
      const item = document.createElement('div');
      item.className = 'activity-item';

      let dotClass = '';
      if (evt.state === 'CRITICAL' || evt.state === 'CONTAINED') dotClass = 'danger';
      else if (evt.state === 'SUSPICIOUS' || evt.state === 'OBSERVING') dotClass = 'warning';

      item.innerHTML = `
        <div class="act-left">
          <span class="act-dot ${dotClass}"></span>
          <div>
            <div class="act-title">${evt.title}</div>
            <div class="act-time">${evt.timeFormatted} • ${evt.description.substring(0, 75)}...</div>
          </div>
        </div>
        <span class="badge ${evt.state === 'NORMAL' ? 'badge-success' : 'badge-warning'}">${evt.state}</span>
      `;
      dashboardRecentList.appendChild(item);
    });
  }

  // 4. Timeline
  async function loadTimeline() {
    if (!api) return;
    const events = await api.getEvents({ state: currentTimelineFilter });
    timelineEntries.innerHTML = '';

    if (events.length === 0) {
      timelineEntries.innerHTML = '<div class="empty-state">No events matching this filter.</div>';
      return;
    }

    events.forEach(evt => {
      const entry = document.createElement('div');
      entry.className = 'timeline-entry';

      let badgeClass = 'badge-info';
      if (evt.state === 'NORMAL' || evt.state === 'RECOVERED') badgeClass = 'badge-success';
      if (evt.state === 'SUSPICIOUS' || evt.state === 'OBSERVING') badgeClass = 'badge-warning';
      if (evt.state === 'CRITICAL' || evt.state === 'CONTAINED') badgeClass = 'badge-danger';

      entry.innerHTML = `
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">${evt.title}</span>
          <span class="act-time">${evt.timeFormatted}</span>
        </div>
        <p class="timeline-entry-desc">${evt.description}</p>
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <span class="badge ${badgeClass}">${evt.state}</span>
          ${evt.process ? `<span class="badge badge-info">${evt.process.name}</span>` : ''}
        </div>
      `;
      timelineEntries.appendChild(entry);
    });
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTimelineFilter = pill.dataset.filter;
      loadTimeline();
    });
  });

  // 5. Actions & Buttons
  btnRecoverMain.addEventListener('click', async () => {
    recoveryProgressBox.style.display = 'block';
    recoveryProgressBar.style.width = '0%';
    recoveryProgressCounter.textContent = 'Preparing...';

    const res = await api.executeRecovery();
    recoveryProgressBar.style.width = '100%';
    recoveryProgressCounter.textContent = `${res.totalRestored} restored`;

    setTimeout(() => {
      recoveryProgressBox.style.display = 'none';
      recoverySuccessBox.style.display = 'flex';
      recoverySuccessText.textContent = `${res.totalRestored} files restored and cryptographically verified. No changes remain.`;
    }, 400);
  });

  btnAllowActivity.addEventListener('click', async () => {
    if (confirm('Are you sure you want to allow this process and resume its execution?')) {
      await api.allowActivity();
      switchTab('dashboard');
    }
  });

  btnDemoBaseline.addEventListener('click', async () => {
    btnDemoBaseline.disabled = true;
    btnDemoBaseline.textContent = 'Generating...';
    await api.runScenario('SETUP_BASELINE');
    btnDemoBaseline.disabled = false;
    btnDemoBaseline.textContent = '✓ Documents Initialized';
    setTimeout(() => {
      btnDemoBaseline.textContent = 'Generate Test Documents';
    }, 2500);
  });

  btnDemoNormal.addEventListener('click', async () => {
    btnDemoNormal.disabled = true;
    btnDemoNormal.textContent = 'Running Update...';
    await api.runScenario('NORMAL_UPDATE');
    btnDemoNormal.disabled = false;
    btnDemoNormal.textContent = '✓ Update Completed (Normal)';
    setTimeout(() => {
      btnDemoNormal.textContent = 'Run Update Simulation';
    }, 2500);
  });

  btnDemoSuspicious.addEventListener('click', async () => {
    btnDemoSuspicious.disabled = true;
    btnDemoSuspicious.textContent = 'Executing Burst...';
    await api.runScenario('SUSPICIOUS_BURST');
    btnDemoSuspicious.disabled = false;
    btnDemoSuspicious.textContent = 'Run Burst Tampering';
    switchTab('incident');
  });

  btnChangeFolder.addEventListener('click', async () => {
    const selected = await api.selectFolder();
    if (selected) {
      await api.startMonitoring(selected);
    }
  });

  btnRebaseline.addEventListener('click', async () => {
    if (currentState && currentState.monitoredDir) {
      await api.startMonitoring(currentState.monitoredDir);
      alert('Baseline snapshot successfully updated for the monitored folder.');
    }
  });

  // Real-time API event hooks
  api.onStateChanged((state) => {
    renderState(state);
  });

  api.onRecoveryProgress((progress) => {
    recoveryProgressBox.style.display = 'block';
    const percent = Math.round((progress.current / Math.max(1, progress.total)) * 100);
    recoveryProgressBar.style.width = `${percent}%`;
    recoveryProgressCounter.textContent = `${progress.current} / ${progress.total}`;
  });

  // Initialize
  initTheme();
  const initialState = await api.getState();
  renderState(initialState);
});
