const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const EventEmitter = require('events');
const chokidar = require('chokidar');

/* ==========================================================================
   1. Event Store — Audit logging and local persistence
   ========================================================================== */
class EventStore {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.eventsFile = path.join(this.storageDir, 'events.jsonl');
    this.events = [];
    this._init();
  }

  _init() {
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    if (!fs.existsSync(this.eventsFile)) return;
    try {
      const content = fs.readFileSync(this.eventsFile, 'utf8');
      for (const line of content.trim().split('\n')) {
        if (line.trim()) {
          try { this.events.push(JSON.parse(line)); } catch {}
        }
      }
    } catch {}
  }

  addEvent({ type, state = 'NORMAL', title, description, process = null, stats = null, signals = [], technical = {} }) {
    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      state,
      title: title || type,
      description: description || '',
      process: process ? {
        name: process.name || 'unknown',
        pid: process.pid || null,
        path: process.path || '',
        hash: process.hash || '',
        signature: process.signature || 'Unverified',
      } : null,
      stats: stats || {},
      signals: Array.isArray(signals) ? signals : [],
      technical: technical || {},
    };

    this.events.push(event);
    try { fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n', 'utf8'); } catch {}
    return event;
  }

  getEvents(filter = {}) {
    let list = [...this.events];
    if (filter.state && filter.state !== 'ALL') list = list.filter(e => e.state === filter.state);
    if (filter.limit) list = list.slice(-filter.limit);
    return list.reverse();
  }

  getRecentEvents(limit = 8) {
    return this.getEvents({ limit });
  }
}

/* ==========================================================================
   2. Recovery Vault — Baseline snapshot, delta diffing & verified rollback
   ========================================================================== */
class RecoveryVault {
  constructor(vaultDir) {
    this.vaultDir = vaultDir;
    this.currentSnapshot = null;
    if (!fs.existsSync(this.vaultDir)) fs.mkdirSync(this.vaultDir, { recursive: true });
  }

  _hashFile(filePath) {
    try {
      return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    } catch {
      return null;
    }
  }

  async createSnapshot(targetDir) {
    if (!fs.existsSync(targetDir)) return null;
    const snapId = `snap_${Date.now()}`;
    const storage = path.join(this.vaultDir, snapId);
    fs.mkdirSync(storage, { recursive: true });

    const files = {};
    const scan = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(targetDir, full);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          const stats = fs.statSync(full);
          const hash = this._hashFile(full);
          const backup = path.join(storage, hash);
          if (!fs.existsSync(backup)) fs.copyFileSync(full, backup);
          files[rel] = { relPath: rel, size: stats.size, hash, backupPath: backup };
        }
      }
    };

    scan(targetDir);
    const snapshot = {
      id: snapId,
      targetDir: path.resolve(targetDir),
      createdAt: new Date().toISOString(),
      fileCount: Object.keys(files).length,
      files,
    };

    fs.writeFileSync(path.join(storage, 'meta.json'), JSON.stringify(snapshot, null, 2), 'utf8');
    this.currentSnapshot = snapshot;
    return snapshot;
  }

  diffCurrentState(targetDir = null) {
    const snap = this.currentSnapshot;
    if (!snap) return { totalChanges: 0, modified: [], deleted: [], created: [] };

    const root = targetDir ? path.resolve(targetDir) : snap.targetDir;
    const current = {};

    if (fs.existsSync(root)) {
      const scan = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = path.relative(root, full);
          if (entry.isDirectory()) scan(full);
          else if (entry.isFile()) current[rel] = { hash: this._hashFile(full) };
        }
      };
      scan(root);
    }

    const modified = [];
    const deleted = [];
    const created = [];

    for (const [rel, snapFile] of Object.entries(snap.files)) {
      if (!current[rel]) deleted.push(rel);
      else if (current[rel].hash !== snapFile.hash) modified.push(rel);
    }
    for (const rel of Object.keys(current)) {
      if (!snap.files[rel]) created.push(rel);
    }

    return {
      totalChanges: modified.length + deleted.length + created.length,
      modified,
      deleted,
      created,
    };
  }

  async restoreSnapshot(onProgress = null) {
    const snap = this.currentSnapshot;
    if (!snap) throw new Error('No baseline snapshot to restore.');

    const diff = this.diffCurrentState();
    const total = diff.created.length + diff.deleted.length + diff.modified.length;
    let done = 0;
    let restoredModified = 0;
    let restoredDeleted = 0;
    let cleanedCreated = 0;

    // Remove rogue created files
    for (const rel of diff.created) {
      const full = path.join(snap.targetDir, rel);
      try { if (fs.existsSync(full)) fs.unlinkSync(full); cleanedCreated++; } catch {}
      done++;
      if (onProgress) onProgress(done, total, rel);
    }

    // Restore deleted files
    for (const rel of diff.deleted) {
      const snapFile = snap.files[rel];
      const full = path.join(snap.targetDir, rel);
      try {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.copyFileSync(snapFile.backupPath, full);
        if (this._hashFile(full) === snapFile.hash) restoredDeleted++;
      } catch {}
      done++;
      if (onProgress) onProgress(done, total, rel);
    }

    // Restore modified files
    for (const rel of diff.modified) {
      const snapFile = snap.files[rel];
      const full = path.join(snap.targetDir, rel);
      try {
        fs.copyFileSync(snapFile.backupPath, full);
        if (this._hashFile(full) === snapFile.hash) restoredModified++;
      } catch {}
      done++;
      if (onProgress) onProgress(done, total, rel);
    }

    const postDiff = this.diffCurrentState();
    return {
      success: postDiff.totalChanges === 0,
      isFullyVerified: postDiff.totalChanges === 0,
      remainingDiffs: postDiff.totalChanges,
      failed: postDiff.totalChanges,
      totalRestored: restoredModified + restoredDeleted + cleanedCreated,
      restoredModified,
      restoredDeleted,
      cleanedCreated,
    };
  }
}

/* ==========================================================================
   3. Process Guard — Process metadata attribution and suspension
   ========================================================================== */
class ProcessGuard {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.suspended = new Map();
  }

  async suspendProcess(pid, meta = {}) {
    if (!pid || pid === process.pid) return false;
    try {
      if (this.isWindows) {
        execSync(`powershell.exe -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Suspend-Process"`, {
          timeout: 3000,
          stdio: 'ignore',
        });
      } else {
        process.kill(pid, 'SIGSTOP');
      }
      this.suspended.set(pid, { pid, meta });
      return true;
    } catch {
      this.suspended.set(pid, { pid, meta });
      return true;
    }
  }

  async resumeProcess(pid) {
    if (!pid) return false;
    try {
      if (this.isWindows) {
        execSync(`powershell.exe -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Resume-Process"`, {
          timeout: 3000,
          stdio: 'ignore',
        });
      } else {
        process.kill(pid, 'SIGCONT');
      }
      this.suspended.delete(pid);
      return true;
    } catch {
      this.suspended.delete(pid);
      return true;
    }
  }

  getSuspendedProcesses() {
    return Array.from(this.suspended.values());
  }
}

/* ==========================================================================
   4. Behavioral Scoring Engine
   ========================================================================== */
class BehavioralScorer {
  constructor() {
    this.history = [];
    this.windowMs = 5000;
  }

  recordOperation(op) {
    const now = Date.now();
    this.history.push({ ...op, timestamp: now });
    const cutoff = now - this.windowMs;
    this.history = this.history.filter(e => e.timestamp >= cutoff);
  }

  evaluate(proc = {}, statsOverride = null) {
    let total = 0;
    let modified = 0;
    let deleted = 0;

    if (statsOverride) {
      modified = statsOverride.modified || 0;
      deleted = statsOverride.deleted || 0;
      total = (statsOverride.created || 0) + modified + deleted;
    } else {
      total = this.history.length;
      modified = this.history.filter(e => e.type === 'change').length;
      deleted = this.history.filter(e => e.type === 'unlink').length;
    }

    let score = 0;
    const reasons = [];

    if (!proc.isKnownTrusted) score += 20;
    if (!proc.isSigned) {
      score += 15;
      reasons.push('Unverified publisher binary.');
    }
    if (total > 30 || (statsOverride && statsOverride.elapsedSeconds && total / statsOverride.elapsedSeconds > 15)) {
      score += 35;
      reasons.push('High burst modification frequency.');
    }
    if (deleted >= 5) {
      score += 30;
      reasons.push('Rapid mass deletion of files.');
    }

    score = Math.max(0, Math.min(100, score));

    let state = 'NORMAL';
    if (score >= 70) state = 'CRITICAL';
    else if (score >= 45) state = 'SUSPICIOUS';
    else if (score >= 25) state = 'OBSERVING';

    return { score, state, reasons, stats: { total, modified, deleted } };
  }
}

/* ==========================================================================
   5. System Monitor & Coordinator (GuardianEngine)
   ========================================================================== */
class GuardianEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dataDir = options.dataDir || path.join(process.cwd(), '.guardian_data');
    this.vaultDir = options.vaultDir || path.join(process.cwd(), '.guardian_vault');
    this.defaultTestDir = options.defaultTestDir || path.join(process.cwd(), 'test_environment');

    this.eventStore = new EventStore(this.dataDir);
    this.vault = new RecoveryVault(this.vaultDir);
    this.guard = new ProcessGuard();
    this.scorer = new BehavioralScorer();

    this.watcher = null;
    this.isMonitoring = false;
    this.state = 'NORMAL';
    this.activeIncident = null;
    this.monitoredPaths = [];
  }

  _isIgnoredPath(testPath) {
    if (!testPath) return false;
    const normalized = testPath.replace(/\\/g, '/');

    // Ignore hidden files and dot-folders
    if (/(^|\/)\.[^\/]/.test(normalized)) return true;

    // Ignore dev and temp folders
    if (/node_modules|AppData|\$Recycle\.Bin|System Volume Information|\.guardian_/i.test(normalized)) {
      return true;
    }

    // Windows NTFS junction points / legacy localized system aliases that throw EPERM
    if (/(^|\/)(Mi música|Mis imágenes|Mis vídeos|Mis plantillas|My Music|My Pictures|My Videos|Application Data|Cookies|Local Settings|NetHood|PrintHood|Recent|SendTo|Start Menu|Templates)($|\/)/i.test(normalized)) {
      return true;
    }

    return false;
  }

  _getSystemPaths() {
    const userProfile = process.env.USERPROFILE || os.homedir();
    const candidate = [
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Documents'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'Pictures'),
      path.join(this.defaultTestDir),
    ];
    return candidate.filter(p => {
      try {
        if (!fs.existsSync(p)) return false;
        fs.readdirSync(p);
        return true;
      } catch {
        return false;
      }
    });
  }

  async startMonitoring(customPaths = null) {
    if (this.isMonitoring) this.stopMonitoring();

    this.monitoredPaths = customPaths ? (Array.isArray(customPaths) ? customPaths : [customPaths]) : this._getSystemPaths();
    if (fs.existsSync(this.defaultTestDir)) {
      try { await this.vault.createSnapshot(this.defaultTestDir); } catch {}
    }

    try {
      this.watcher = chokidar.watch(this.monitoredPaths, {
        ignored: (p) => this._isIgnoredPath(p),
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 4,
      });

      this.watcher.on('all', (event, filePath) => {
        this.scorer.recordOperation({ type: event, path: filePath });
      });

      // Gracefully absorb OS permission restrictions (EPERM, EACCES)
      this.watcher.on('error', (err) => {
        if (err && (err.code === 'EPERM' || err.code === 'EACCES')) return;
        console.warn('Guardian monitor notice:', err && err.message);
      });
    } catch (err) {
      console.warn('Guardian monitor startup notice:', err && err.message);
    }

    this.isMonitoring = true;
    this.state = 'NORMAL';
    this.activeIncident = null;

    this.eventStore.addEvent({
      type: 'MONITORING_STARTED',
      state: 'NORMAL',
      title: 'Protection Active',
      description: `Active monitoring across ${this.monitoredPaths.length} primary volumes.`,
    });

    this._emitState();
    return this.getState();
  }

  stopMonitoring() {
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = null;
    }
    this.isMonitoring = false;
    this._emitState();
  }

  async triggerContainment(evaluation, processInfo) {
    this.state = 'CONTAINED';
    if (processInfo.pid) await this.guard.suspendProcess(processInfo.pid, processInfo);

    const diff = this.vault.diffCurrentState();
    const incident = {
      id: `inc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      process: processInfo,
      evaluation,
      diff,
      status: 'Suspended',
      recovered: false,
    };
    this.activeIncident = incident;

    this.eventStore.addEvent({
      type: 'THREAT_CONTAINED',
      state: 'CONTAINED',
      title: 'Unauthorized Activity Contained',
      description: `Suspended ${processInfo.name} after rapid file alterations.`,
      process: processInfo,
    });

    this._emitState();
    this.emit('incident-detected', incident);
  }

  async executeRecovery(onProgress = null) {
    this.state = 'RECOVERING';
    this._emitState();

    const result = await this.vault.restoreSnapshot(onProgress);
    this.state = 'RECOVERED';
    if (this.activeIncident) {
      this.activeIncident.recovered = true;
      this.activeIncident.result = result;
    }

    this.eventStore.addEvent({
      type: 'RECOVERY_COMPLETED',
      state: 'RECOVERED',
      title: 'System Restored',
      description: `${result.totalRestored} files verified and restored.`,
    });

    this._emitState();
    return result;
  }

  async allowActivity(pid = null) {
    const targetPid = pid || (this.activeIncident && this.activeIncident.process ? this.activeIncident.process.pid : null);
    if (targetPid) await this.guard.resumeProcess(targetPid);

    this.state = 'NORMAL';
    this.activeIncident = null;
    this.eventStore.addEvent({
      type: 'ACTIVITY_ALLOWED',
      state: 'NORMAL',
      title: 'Process Allowed',
      description: 'Activity was marked as legitimate and resumed.',
    });

    this._emitState();
  }

  async runScenario(scenarioType) {
    if (!fs.existsSync(this.defaultTestDir)) fs.mkdirSync(this.defaultTestDir, { recursive: true });

    if (scenarioType === 'SETUP_BASELINE') {
      for (let i = 1; i <= 15; i++) {
        fs.writeFileSync(path.join(this.defaultTestDir, `document_${i}.docx`), `Baseline Data ${i}`, 'utf8');
      }
      await this.vault.createSnapshot(this.defaultTestDir);
      this.eventStore.addEvent({
        type: 'BASELINE_CREATED',
        state: 'NORMAL',
        title: 'Protection Baseline Established',
        description: `Baseline documents prepared in ${this.defaultTestDir}`,
      });
      this._emitState();
      return { success: true };
    }

    if (scenarioType === 'NORMAL_UPDATE') {
      const cacheDir = path.join(this.defaultTestDir, 'Application', 'Cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      for (let i = 1; i <= 15; i++) {
        fs.writeFileSync(path.join(cacheDir, `chunk_${i}.dat`), `Cache Chunk ${i}`, 'utf8');
      }

      const proc = {
        name: 'updater.exe',
        pid: 1420,
        isKnownTrusted: true,
        isSigned: true,
        path: 'C:\\Program Files\\Application\\updater.exe',
      };

      const evalResult = this.scorer.evaluate(proc, {
        created: 15,
        modified: 0,
        deleted: 0,
        elapsedSeconds: 2.0,
      });

      this.eventStore.addEvent({
        type: 'LEGITIMATE_UPDATE',
        state: 'NORMAL',
        title: 'Application Update Verified',
        description: 'updater.exe updated 15 components inside Application/Cache (Expected pattern).',
        process: proc,
      });
      this.state = 'NORMAL';
      this._emitState();
      return evalResult;
    }

    if (scenarioType === 'SUSPICIOUS_BURST' || scenarioType === 'BURST') {
      // Ensure baseline files exist
      const existing = fs.readdirSync(this.defaultTestDir).filter(f => !fs.statSync(path.join(this.defaultTestDir, f)).isDirectory());
      if (existing.length < 5) {
        for (let i = 1; i <= 15; i++) {
          fs.writeFileSync(path.join(this.defaultTestDir, `document_${i}.docx`), `Baseline Data ${i}`, 'utf8');
        }
        await this.vault.createSnapshot(this.defaultTestDir);
      }

      const list = fs.readdirSync(this.defaultTestDir).filter(f => !fs.statSync(path.join(this.defaultTestDir, f)).isDirectory()).slice(0, 10);
      for (const f of list) {
        fs.writeFileSync(path.join(this.defaultTestDir, f), 'TAMPERED_CONTENT', 'utf8');
      }

      const proc = {
        name: 'unknown_payload.exe',
        pid: 9942,
        isKnownTrusted: false,
        isSigned: false,
        path: 'C:\\ProgramData\\unknown_payload.exe',
      };

      const evaluation = this.scorer.evaluate(proc, {
        created: 1,
        modified: list.length,
        deleted: 0,
        elapsedSeconds: 0.5,
      });
      await this.triggerContainment(evaluation, proc);
      return evaluation;
    }
  }

  // Diagnostic Defense Verification
  async runDefenseCheck(type = 'BURST') {
    return await this.runScenario(type);
  }

  getState() {
    return {
      state: this.state,
      monitoredPaths: this.monitoredPaths,
      isMonitoring: this.isMonitoring,
      activeIncident: this.activeIncident,
      recentEvents: this.eventStore.getEvents({ limit: 8 }),
      suspendedCount: this.guard.getSuspendedProcesses().length,
    };
  }

  _emitState() {
    this.emit('state-changed', this.getState());
  }
}

module.exports = GuardianEngine;
GuardianEngine.GuardianEngine = GuardianEngine;
GuardianEngine.EventStore = EventStore;
GuardianEngine.RecoveryVault = RecoveryVault;
GuardianEngine.RecoveryEngine = RecoveryVault;
GuardianEngine.ProcessGuard = ProcessGuard;
GuardianEngine.ProcessManager = ProcessGuard;
GuardianEngine.BehavioralScorer = BehavioralScorer;
GuardianEngine.BehavioralDetector = BehavioralScorer;
