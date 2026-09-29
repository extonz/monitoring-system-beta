class BehavioralDetector {
  constructor(config = {}) {
    this.config = {
      windowMs: 5000,           // Sliding window for rate measurement (5 seconds)
      highRateThreshold: 15,    // ops per second
      criticalRateThreshold: 40,// ops per second
      massDeletionCount: 5,     // rapid deletions threshold
      ...config,
    };

    // Rolling window of file activity events
    this.activityHistory = [];
  }

  /**
   * Record a file system event in the rolling window
   * @param {Object} op - { type: 'add'|'change'|'unlink', path: string, timestamp: number }
   */
  recordOperation(op) {
    const now = Date.now();
    this.activityHistory.push({
      ...op,
      timestamp: op.timestamp || now,
    });
    // Prune events outside sliding window
    const cutoff = now - this.config.windowMs;
    this.activityHistory = this.activityHistory.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Analyze recent behavioral activity for a given process context
   * @param {Object} processMeta - { name, pid, isSigned, isKnownTrusted, path }
   * @param {Object} [directStats] - optional explicit stats (e.g. from simulator or folder diff)
   * @returns {Object} Evaluation with score, state, explanation, and signals
   */
  evaluate(processMeta = {}, directStats = null) {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const recentOps = this.activityHistory.filter(e => e.timestamp >= cutoff);

    let createdCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    if (directStats) {
      createdCount = directStats.created || 0;
      modifiedCount = directStats.modified || 0;
      deletedCount = directStats.deleted || 0;
    } else {
      for (const op of recentOps) {
        if (op.type === 'add') createdCount++;
        else if (op.type === 'change') modifiedCount++;
        else if (op.type === 'unlink') deletedCount++;
      }
    }

    const totalOps = createdCount + modifiedCount + deletedCount;
    const windowSeconds = Math.max(1, this.config.windowMs / 1000);
    const rate = directStats && directStats.elapsedSeconds
      ? totalOps / directStats.elapsedSeconds
      : totalOps / windowSeconds;

    let score = 0;
    const signals = [];
    const reasons = [];

    // 1. Process identity & signature signals
    if (!processMeta.isKnownTrusted) {
      score += 20;
      signals.push('unknown_process');
    } else {
      score -= 25; // Trust reduction
    }

    if (!processMeta.isSigned) {
      score += 15;
      signals.push('unsigned_executable');
      reasons.push('The process executable is not digitally signed by a verified publisher.');
    }

    // 2. High modification rate
    if (rate >= this.config.criticalRateThreshold || totalOps > 100) {
      score += 35;
      signals.push('extreme_burst_rate');
      reasons.push(`The modification rate was unusually high (${Math.round(rate)} operations/sec).`);
    } else if (rate >= this.config.highRateThreshold || totalOps > 30) {
      score += 20;
      signals.push('high_burst_rate');
      reasons.push(`Elevated file activity rate observed.`);
    }

    // 3. Mass deletion check
    if (deletedCount >= this.config.massDeletionCount) {
      score += 30;
      signals.push('mass_deletion');
      reasons.push(`A rapid mass deletion of files was observed (${deletedCount} files deleted).`);
    }

    // 4. File patterns (e.g. document files or encrypted extensions)
    const affectedSample = directStats ? (directStats.filesSample || []) : recentOps.map(o => o.path);
    const hasDocuments = affectedSample.some(p => /\.(docx?|pdf|xlsx?|txt|jpg|png|json)$/i.test(p));
    const hasSuspiciousExt = affectedSample.some(p => /\.(locked|enc|crypto|crypted)$/i.test(p));

    if (hasDocuments) {
      score += 15;
      signals.push('user_documents_affected');
      reasons.push('User documents and data files were directly affected.');
    }

    if (hasSuspiciousExt) {
      score += 40;
      signals.push('ransom_extension_pattern');
      reasons.push('Suspicious encrypted file extension pattern detected.');
    }

    // Clamp score 0 - 100
    score = Math.max(0, Math.min(100, score));

    // Determine state
    let state = 'NORMAL';
    if (score >= 80) {
      state = 'CRITICAL';
    } else if (score >= 50) {
      state = 'SUSPICIOUS';
    } else if (score >= 25) {
      state = 'OBSERVING';
    }

    // Summary description
    let explanation = 'Activity is within expected operating parameters.';
    if (state === 'CRITICAL' || state === 'SUSPICIOUS') {
      const procName = processMeta.name || 'An unknown process';
      explanation = `${procName} caused ${totalOps} file operations in a short period of time.`;
      if (reasons.length === 0) {
        reasons.push('Unusually high concentration of file system alterations.');
      }
    } else if (state === 'OBSERVING') {
      explanation = 'Slightly elevated file changes observed; continuing passive observation.';
    }

    return {
      score,
      state,
      explanation,
      reasons,
      signals,
      stats: {
        totalOps,
        modified: modifiedCount,
        deleted: deletedCount,
        created: createdCount,
        rate: Math.round(rate),
      },
    };
  }

  clearHistory() {
    this.activityHistory = [];
  }
}

module.exports = BehavioralDetector;
