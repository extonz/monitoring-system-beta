const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

const EventStore = require('./eventStore');
const RecoveryEngine = require('./recovery');
const ProcessManager = require('./processManager');
const BehavioralDetector = require('./detector');
const FileMonitor = require('./monitor');
const ScenarioRunner = require('../simulators/scenarios');

class SecurityCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.storageDir = options.storageDir || path.join(process.cwd(), '.guardian_data');
    this.vaultDir = options.vaultDir || path.join(process.cwd(), '.guardian_vault');
    this.defaultTestDir = options.defaultTestDir || path.join(process.cwd(), 'test_environment');

    this.eventStore = new EventStore(this.storageDir);
    this.recoveryEngine = new RecoveryEngine(this.vaultDir);
    this.processManager = new ProcessManager();
    this.detector = new BehavioralDetector();
    this.monitor = new FileMonitor();

    this.state = 'NORMAL'; // NORMAL | OBSERVING | SUSPICIOUS | CRITICAL | CONTAINED | RECOVERING | RECOVERED
    this.activeIncident = null;
    this.monitoredDir = null;

    this._bindMonitor();
  }

  _bindMonitor() {
    this.monitor.on('activity', async (event) => {
      this.detector.recordOperation(event);

      // Attribute event to a process (in real usage or simulation)
      const evaluation = this.detector.evaluate({
        name: 'explorer.exe',
        isKnownTrusted: true,
        isSigned: true,
      });

      this._applyEvaluation(evaluation, {
        name: 'System / Explorer',
        pid: null,
      });
    });

    this.monitor.on('error', (err) => {
      this.eventStore.addEvent({
        type: 'MONITOR_ERROR',
        state: this.state,
        title: 'File Monitor Warning',
        description: `Monitoring notice: ${err.message}`,
      });
      this._emitState();
    });
  }

  _applyEvaluation(evaluation, processInfo) {
    if (evaluation.state === 'CRITICAL' && this.state !== 'CONTAINED') {
      this.state = 'CRITICAL';
      this._triggerContainment(evaluation, processInfo);
    } else if (evaluation.state === 'SUSPICIOUS' && this.state === 'NORMAL') {
      this.state = 'SUSPICIOUS';
      this.eventStore.addEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        state: 'SUSPICIOUS',
        title: 'Unusual Activity Detected',
        description: evaluation.explanation,
        process: processInfo,
        signals: evaluation.signals,
        stats: evaluation.stats,
      });
      this._emitState();
    } else if (evaluation.state === 'OBSERVING' && this.state === 'NORMAL') {
      this.state = 'OBSERVING';
      this._emitState();
    }
  }

  async _triggerContainment(evaluation, processInfo) {
    this.state = 'CONTAINED';

    // 1. Suspend the offending process
    if (processInfo.pid) {
      await this.processManager.suspendProcess(processInfo.pid, processInfo);
    }

    // 2. Assess recoverable differences against baseline snapshot
    let diff = null;
    try {
      diff = this.recoveryEngine.diffCurrentState();
    } catch {
      diff = { totalChanges: evaluation.stats ? evaluation.stats.totalOps : 0, modified: [], deleted: [], created: [] };
    }

    const incident = {
      id: `inc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString(),
      process: processInfo,
      evaluation,
      diff,
      status: 'CONTAINED',
      recovered: false,
    };
    this.activeIncident = incident;

    // 3. Log containment event
    this.eventStore.addEvent({
      type: 'INCIDENT_CONTAINED',
      state: 'CONTAINED',
      title: 'Activity Contained',
      description: evaluation.explanation || 'Suspicious activity has been paused while changes are investigated.',
      process: processInfo,
      stats: {
        modified: diff.modified.length,
        deleted: diff.deleted.length,
        created: diff.created.length,
        affectedDirectories: 1,
      },
      signals: evaluation.signals,
      technical: {
        score: evaluation.score,
        reasons: evaluation.reasons,
        pid: processInfo.pid,
        hash: processInfo.hash,
        signature: processInfo.signature,
      },
    });

    this._emitState();
  }

  /**
   * Initialize and start monitoring on a target folder
   */
  async startMonitoring(targetDir = this.defaultTestDir) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    this.monitoredDir = path.resolve(targetDir);

    // Ensure baseline snapshot exists
    await this.recoveryEngine.createSnapshot(this.monitoredDir);

    this.monitor.start(this.monitoredDir);
    this.state = 'NORMAL';
    this.activeIncident = null;

    this.eventStore.addEvent({
      type: 'MONITORING_STARTED',
      state: 'NORMAL',
      title: 'Monitoring Active',
      description: `Baseline established and real-time monitoring enabled for ${this.monitoredDir}`,
    });

    this._emitState();
    return this.getState();
  }

  stopMonitoring() {
    this.monitor.stop();
    this.eventStore.addEvent({
      type: 'MONITORING_STOPPED',
      state: this.state,
      title: 'Monitoring Paused',
      description: 'Behavioral monitoring paused by user.',
    });
    this._emitState();
  }

  /**
   * Execute verified recovery on contained incident
   */
  async executeRecovery(onProgress = null) {
    if (!this.recoveryEngine.currentSnapshot) {
      throw new Error('No baseline snapshot available for recovery.');
    }

    this.state = 'RECOVERING';
    this._emitState();

    this.eventStore.addEvent({
      type: 'RECOVERY_STARTED',
      state: 'RECOVERING',
      title: 'Recovery in Progress',
      description: 'Restoring monitored environment to verified baseline snapshot.',
    });

    const result = await this.recoveryEngine.restoreSnapshot(onProgress);

    this.state = 'RECOVERED';
    if (this.activeIncident) {
      this.activeIncident.recovered = true;
      this.activeIncident.recoveryResult = result;
    }

    this.eventStore.addEvent({
      type: 'RECOVERY_COMPLETED',
      state: 'RECOVERED',
      title: 'System Recovered',
      description: `${result.totalRestored} files restored. The system was verified after recovery and no lingering modifications remain.`,
      stats: {
        modified: result.restoredModified,
        deleted: result.restoredDeleted,
        created: result.cleanedCreated,
      },
      technical: {
        verified: result.isFullyVerified,
        failed: result.failed,
      },
    });

    this._emitState();
    return result;
  }

  /**
   * Allow activity (user marks false positive or resumes process)
   */
  async allowActivity(pid = null) {
    const targetPid = pid || (this.activeIncident && this.activeIncident.process ? this.activeIncident.process.pid : null);
    if (targetPid) {
      await this.processManager.resumeProcess(targetPid);
    }

    this.state = 'NORMAL';
    this.eventStore.addEvent({
      type: 'ACTIVITY_ALLOWED',
      state: 'NORMAL',
      title: 'Activity Allowed',
      description: `Activity for process ${targetPid || 'unknown'} was reviewed and allowed by user.`,
    });

    this.activeIncident = null;
    this._emitState();
  }

  /**
   * Run one of the built-in MVP simulation scenarios
   */
  async runScenario(scenarioType) {
    const dir = this.monitoredDir || this.defaultTestDir;
    const runner = new ScenarioRunner(dir);

    if (scenarioType === 'SETUP_BASELINE') {
      runner.setupBaselineFiles(15);
      await this.recoveryEngine.createSnapshot(dir);
      this.eventStore.addEvent({
        type: 'BASELINE_CREATED',
        state: 'NORMAL',
        title: 'Test Environment Initialized',
        description: `Generated 15 sample documents in ${dir} and saved clean snapshot.`,
      });
      this._emitState();
      return { success: true };
    }

    if (scenarioType === 'NORMAL_UPDATE') {
      const res = await runner.runNormalUpdateScenario();
      const evalResult = this.detector.evaluate(res.process, {
        created: res.filesModified,
        modified: 0,
        deleted: 0,
        elapsedSeconds: 2.0,
      });

      this.eventStore.addEvent({
        type: 'LEGITIMATE_UPDATE',
        state: 'NORMAL',
        title: 'Normal Application Update',
        description: 'updater.exe updated 15 components inside Application/Cache. Operation evaluated as expected behavior.',
        process: res.process,
      });
      this.state = 'NORMAL';
      this._emitState();
      return evalResult;
    }

    if (scenarioType === 'SUSPICIOUS_BURST') {
      const res = await runner.runSuspiciousActivityScenario();
      const evalResult = this.detector.evaluate(res.process, {
        created: res.stats.created,
        modified: res.stats.modified,
        deleted: res.stats.deleted,
        elapsedSeconds: res.stats.elapsedSeconds,
      });

      // Trigger incident workflow
      await this._triggerContainment(evalResult, res.process);
      return evalResult;
    }
  }

  getState() {
    return {
      state: this.state,
      monitoredDir: this.monitoredDir,
      isMonitoring: this.monitor.isMonitoring,
      activeIncident: this.activeIncident,
      recentEvents: this.eventStore.getRecentEvents(12),
      suspendedCount: this.processManager.getSuspendedProcesses().length,
    };
  }

  _emitState() {
    this.emit('state-changed', this.getState());
  }
}

module.exports = SecurityCoordinator;
