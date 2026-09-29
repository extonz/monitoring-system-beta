const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const GuardianEngine = require('../src/engine/guardian');
const { EventStore, RecoveryVault, BehavioralScorer } = GuardianEngine;

const testDir = path.join(__dirname, 'temp_test_env');
const vaultDir = path.join(__dirname, 'temp_vault');
const dataDir = path.join(__dirname, 'temp_data');

function cleanDirs() {
  [testDir, vaultDir, dataDir].forEach(d => {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
}

test.beforeEach(cleanDirs);
test.after(cleanDirs);

test('RecoveryVault - baseline snapshot, diffing, restoration, and cryptographic verification', async () => {
  fs.mkdirSync(testDir, { recursive: true });
  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(testDir, `doc_${i}.docx`), `Baseline Content ${i}`, 'utf8');
  }

  const vault = new RecoveryVault(vaultDir);
  const snap = await vault.createSnapshot(testDir);
  assert.strictEqual(snap.fileCount, 5);

  // Initial diff is 0
  let diff = vault.diffCurrentState();
  assert.strictEqual(diff.totalChanges, 0);

  // Tamper: modify 1, delete 1, create 1 rogue
  const files = fs.readdirSync(testDir);
  fs.writeFileSync(path.join(testDir, files[0]), 'TAMPERED_DATA');
  fs.unlinkSync(path.join(testDir, files[1]));
  const rogueFile = path.join(testDir, 'rogue_encryptor.lock');
  fs.writeFileSync(rogueFile, 'LOCKED');

  diff = vault.diffCurrentState();
  assert.strictEqual(diff.modified.length, 1);
  assert.strictEqual(diff.deleted.length, 1);
  assert.strictEqual(diff.created.length, 1);

  // Restore and verify
  const res = await vault.restoreSnapshot();
  assert.strictEqual(res.isFullyVerified, true);
  assert.strictEqual(res.remainingDiffs, 0);
  assert.strictEqual(res.totalRestored, 3);
  assert.strictEqual(fs.existsSync(rogueFile), false);
});

test('BehavioralScorer - distinguishes legitimate operations from suspicious burst', () => {
  const scorer = new BehavioralScorer();

  // Legitimate update
  const normalEval = scorer.evaluate(
    { name: 'updater.exe', isKnownTrusted: true, isSigned: true },
    { created: 20, modified: 0, deleted: 0, elapsedSeconds: 2.0 }
  );
  assert.strictEqual(normalEval.state, 'NORMAL');

  // Threat burst
  const threatEval = scorer.evaluate(
    { name: 'unknown_payload.exe', isKnownTrusted: false, isSigned: false },
    { created: 1, modified: 18, deleted: 6, elapsedSeconds: 0.5 }
  );
  assert.strictEqual(threatEval.state, 'CRITICAL');
  assert.ok(threatEval.score >= 70);
  assert.ok(threatEval.reasons.length > 0);
});

test('EventStore - persistence and query filtering', () => {
  const store = new EventStore(dataDir);
  store.addEvent({ type: 'EVENT_A', state: 'NORMAL', title: 'Normal Operation' });
  store.addEvent({ type: 'EVENT_B', state: 'CONTAINED', title: 'Contained Threat' });

  const all = store.getEvents();
  assert.strictEqual(all.length, 2);

  const contained = store.getEvents({ state: 'CONTAINED' });
  assert.strictEqual(contained.length, 1);
  assert.strictEqual(contained[0].title, 'Contained Threat');
});

test('GuardianEngine - full lifecycle: baseline -> update -> burst -> containment -> verified recovery', async () => {
  const engine = new GuardianEngine({
    defaultTestDir: testDir,
    vaultDir: vaultDir,
    dataDir: dataDir,
  });

  // 1. Setup baseline & start monitoring
  await engine.runScenario('SETUP_BASELINE');
  await engine.startMonitoring(testDir);

  let state = engine.getState();
  assert.strictEqual(state.state, 'NORMAL');
  assert.strictEqual(state.isMonitoring, true);

  // 2. Normal update
  await engine.runScenario('NORMAL_UPDATE');
  state = engine.getState();
  assert.strictEqual(state.state, 'NORMAL');
  assert.strictEqual(state.activeIncident, null);

  // 3. Suspicious burst containment
  await engine.runScenario('SUSPICIOUS_BURST');
  state = engine.getState();
  assert.strictEqual(state.state, 'CONTAINED');
  assert.ok(state.activeIncident);
  assert.strictEqual(state.activeIncident.process.name, 'unknown_payload.exe');

  // 4. Verified Recovery
  const recRes = await engine.executeRecovery();
  assert.strictEqual(recRes.isFullyVerified, true);
  assert.strictEqual(recRes.remainingDiffs, 0);

  state = engine.getState();
  assert.strictEqual(state.state, 'RECOVERED');
  assert.strictEqual(state.activeIncident.recovered, true);

  // 5. Allow & Resume
  await engine.allowActivity();
  state = engine.getState();
  assert.strictEqual(state.state, 'NORMAL');
  assert.strictEqual(state.activeIncident, null);

  // 6. Stop monitoring
  engine.stopMonitoring();
  state = engine.getState();
  assert.strictEqual(state.isMonitoring, false);
});
