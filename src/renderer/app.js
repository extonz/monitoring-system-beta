// Guardian Minimalist Desktop Utility Logic

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.guardianAPI;

  // View Panes
  const viewDashboard = document.getElementById('view-dashboard');
  const viewIncident = document.getElementById('view-incident');
  const viewTimeline = document.getElementById('view-timeline');

  // Header Elements
  const btnCloseWindow = document.getElementById('btn-close-window');
  const btnQuickTest = document.getElementById('btn-quick-test');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');
  const protectionPill = document.getElementById('protection-pill');

  // Dashboard Elements
  const statusDot = document.getElementById('status-dot');
  const statusHeading = document.getElementById('status-heading');
  const statusSubheading = document.getElementById('status-subheading');
  const scopeDisplay = document.getElementById('scope-display');
  const quickIncidentBar = document.getElementById('quick-incident-bar');
  const qibTitle = document.getElementById('qib-title');
  const qibSub = document.getElementById('qib-sub');
  const btnViewIncidentPane = document.getElementById('btn-view-incident-pane');
  const activityFeed = document.getElementById('activity-feed');
  const btnShowTimeline = document.getElementById('btn-show-timeline');
  const btnSimTamper = document.getElementById('btn-sim-tamper');

  // Incident View Elements
  const btnBackToDash = document.getElementById('btn-back-to-dash');
  const incTitle = document.getElementById('inc-title');
  const incProcTag = document.getElementById('inc-proc-tag');
  const incDesc = document.getElementById('inc-desc');
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

  // Timeline View Elements
  const btnBackFromTimeline = document.getElementById('btn-back-from-timeline');
  const timelineList = document.getElementById('timeline-list');

  let currentIncident = null;

  // 1. Navigation
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

  // Close / minimize to tray
  btnCloseWindow.addEventListener('click', () => {
    if (api && api.hideWindow) {
      api.hideWindow();
    } else {
      window.close();
    }
  });

  // 2. Theme Toggle
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

  // 3. Render State
  function renderState(state) {
    if (!state) return;

    // Scope text
    if (state.monitoredPaths && state.monitoredPaths.length > 0) {
      scopeDisplay.textContent = `System-Wide (${state.monitoredPaths.length} locations including Desktop, Documents, System Drives)`;
    }

    // Hero dot & text
    statusDot.className = 'status-dot';
    statusDot.classList.add(state.state.toLowerCase());

    if (state.state === 'NORMAL') {
      statusHeading.textContent = 'Everything looks good';
      statusSubheading.textContent = 'All drives and user folders actively protected.';
      quickIncidentBar.style.display = 'none';
      protectionPill.textContent = 'System-Wide Active';
      protectionPill.style.color = 'var(--color-success)';
    } else if (state.state === 'OBSERVING') {
      statusHeading.textContent = 'Monitoring elevated activity';
      statusSubheading.textContent = 'Analyzing system file operations.';
      quickIncidentBar.style.display = 'none';
    } else if (state.state === 'CONTAINED' || state.state === 'CRITICAL' || state.state === 'SUSPICIOUS') {
      statusHeading.textContent = 'Activity paused';
      statusSubheading.textContent = 'A process was paused to protect your files.';
      quickIncidentBar.style.display = 'flex';
      protectionPill.textContent = 'Airbag Engaged';
      protectionPill.style.color = 'var(--color-danger)';
    } else if (state.state === 'RECOVERED') {
      statusHeading.textContent = 'System recovered';
      statusSubheading.textContent = 'All altered files were restored and verified.';
      quickIncidentBar.style.display = 'none';
      protectionPill.textContent = 'System Restored';
      protectionPill.style.color = 'var(--color-success)';
    }

    // Populate incident details if present
    if (state.activeIncident) {
      currentIncident = state.activeIncident;
      renderIncident(currentIncident);
    }

    // Render feed
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
    metricStatus.textContent = inc.status || 'PAUSED';

    // Reasons
    incReasons.innerHTML = '';
    const reasons = (inc.evaluation && inc.evaluation.reasons) || [
      'Unusually high file modification rate.',
      'User document areas affected.',
      'Unsigned executable binary.',
    ];
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      incReasons.appendChild(li);
    });

    // Forensics
    fPath.textContent = proc.path || proc.name;
    fPid.textContent = proc.pid || 'N/A';
    fSig.textContent = proc.signature || 'Unverified';
    fHash.textContent = proc.hash || 'N/A';

    if (inc.recovered) {
      btnIncidentRecover.disabled = true;
      btnIncidentRecover.textContent = '✓ Files Restored & Verified';
    } else {
      btnIncidentRecover.disabled = false;
      btnIncidentRecover.textContent = '✓ Restore Files Now';
    }
  }

  function renderFeed(events) {
    activityFeed.innerHTML = '';
    if (events.length === 0) {
      activityFeed.innerHTML = '<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:10px;">Monitoring active. No unusual events.</div>';
      return;
    }

    events.slice(0, 5).forEach(evt => {
      const row = document.createElement('div');
      row.className = 'feed-row';

      let dotClass = '';
      let badgeClass = '';
      if (evt.state === 'CRITICAL' || evt.state === 'CONTAINED') {
        dotClass = 'danger';
        badgeClass = 'danger';
      } else if (evt.state === 'SUSPICIOUS' || evt.state === 'OBSERVING') {
        dotClass = 'warning';
        badgeClass = 'warning';
      }

      row.innerHTML = `
        <div class="feed-row-left">
          <span class="feed-row-dot ${dotClass}"></span>
          <div>
            <span class="feed-name">${evt.process ? evt.process.name : evt.title}</span>
            <div class="feed-desc">${evt.description.substring(0, 48)}...</div>
          </div>
        </div>
        <span class="feed-badge ${badgeClass}">${evt.state}</span>
      `;
      activityFeed.appendChild(row);
    });
  }

  async function loadTimeline() {
    timelineList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-dim); padding:10px;">Loading timeline...</div>';
    const events = await api.getEvents({ limit: 25 });
    timelineList.innerHTML = '';

    if (!events || events.length === 0) {
      timelineList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-dim); padding:10px;">No timeline entries recorded.</div>';
      return;
    }

    events.forEach(e => {
      const item = document.createElement('div');
      item.className = 'tl-item';
      item.innerHTML = `
        <div class="tl-item-top">
          <span class="tl-item-title">${e.title}</span>
          <span class="tl-item-time">${e.timeFormatted}</span>
        </div>
        <div class="tl-item-desc">${e.description}</div>
      `;
      timelineList.appendChild(item);
    });
  }

  // 4. Simulations & Recovery Actions
  async function triggerTamperSimulation() {
    btnSimTamper.disabled = true;
    btnSimTamper.textContent = 'Simulating...';
    await api.runScenario('SETUP_BASELINE');
    await api.runScenario('SUSPICIOUS_BURST');
    btnSimTamper.disabled = false;
    btnSimTamper.textContent = 'Simulate Burst Alert';
    showView('incident');
  }

  btnSimTamper.addEventListener('click', triggerTamperSimulation);
  btnQuickTest.addEventListener('click', triggerTamperSimulation);

  btnIncidentRecover.addEventListener('click', async () => {
    incRecoveryProgress.style.display = 'block';
    incProgressBar.style.width = '20%';
    incProgressCounter.textContent = 'Restoring...';

    const res = await api.executeRecovery();
    incProgressBar.style.width = '100%';
    incProgressCounter.textContent = `${res.totalRestored} restored`;

    setTimeout(() => {
      incRecoveryProgress.style.display = 'none';
      btnIncidentRecover.disabled = true;
      btnIncidentRecover.textContent = `✓ ${res.totalRestored} Files Restored`;
    }, 400);
  });

  btnIncidentAllow.addEventListener('click', async () => {
    await api.allowActivity();
    showView('dashboard');
  });

  // Reactive updates
  api.onStateChanged((state) => {
    renderState(state);
  });

  // Handle direct navigation request (e.g. from popup toast "View Details")
  if (api.onNavigate) {
    api.onNavigate((view) => {
      showView(view);
    });
  }

  // Initialize
  initTheme();
  const initial = await api.getState();
  renderState(initial);
});
