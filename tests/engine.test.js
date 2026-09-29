const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const EventStore = require('../src/engine/eventStore');
const RecoveryEngine = require('../src/engine/recovery');
const BehavioralDetector = require('../src/engine/detector');
const ScenarioRunner = require('../src/simulators/scenarios');

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

test('RecoveryEngine - creates snapshot, computes diffs, restores and verifies', async () => {
  const recovery = new RecoveryEngine(vaultDir);
  const runner = new ScenarioRunner(testDir);

  // 1. Populate baseline
  runner.setupBaselineFiles(5);

  // 2. Snapshot
  const snap = await recovery.createSnapshot(testDir);
  assert.strictEqual(snap.fileCount, 5);

  // 3. Diff should be 0 changes initially
  let diff = recovery.diffCurrentState();
  assert.strictEqual(diff.totalChanges, 0);

  // 4. Modify 1 file, delete 1 file, create 1 rogue file
  const baselineFiles = fs.readdirSync(testDir);
  const fileToModify = path.join(testDir, baselineFiles[0]);
  const fileToDelete = path.join(testDir, baselineFiles[1]);
  const rogueFile = path.join(testDir, 'rogue_encryptor.lock');

  fs.writeFileSync(fileToModify, 'MODIFIED_CONTENT');
  fs.unlinkSync(fileToDelete);
  fs.writeFileSync(rogueFile, 'LOCKED');

  // 5. Diff check
  diff = recovery.diffCurrentState();
  assert.strictEqual(diff.modified.length, 1);
  assert.strictEqual(diff.deleted.length, 1);
  assert.strictEqual(diff.created.length, 1);

  // 6. Restore
  const res = await recovery.restoreSnapshot();
  assert.strictEqual(res.isFullyVerified, true);
  assert.strictEqual(res.totalRestored, 3);
  assert.strictEqual(res.restoredModified, 1);
  assert.strictEqual(res.restoredDeleted, 1);
  assert.strictEqual(res.cleanedCreated, 1);
  assert.strictEqual(fs.existsSync(rogueFile), false);
});

test('BehavioralDetector - distinguishes normal update from suspicious burst', () => {
  const detector = new BehavioralDetector();

  // Test Normal Update
  const normalEval = detector.evaluate(
    { name: 'steam.exe', isKnownTrusted: true, isSigned: true },
    { created: 20, modified: 0, deleted: 0, elapsedSeconds: 2.0 }
  );
  assert.strictEqual(normalEval.state, 'NORMAL');

  // Test Suspicious Rapid Tampering
  const suspiciousEval = detector.evaluate(
    { name: 'unknown_payload.exe', isKnownTrusted: false, isSigned: false },
    { created: 1, modified: 18, deleted: 6, elapsedSeconds: 0.5, filesSample: ['report.docx', 'data.locked'] }
  );
  assert.strictEqual(suspiciousEval.state, 'CRITICAL');
  assert.ok(suspiciousEval.reasons.length > 0);
  assert.ok(suspiciousEval.score >= 80);
});

test('EventStore - records chronological events and filters', () => {
  const store = new EventStore(dataDir);
  store.addEvent({ type: 'TEST_A', state: 'NORMAL', title: 'Normal Event' });
  store.addEvent({ type: 'TEST_B', state: 'CRITICAL', title: 'Critical Event' });

  const all = store.getEvents();
  assert.strictEqual(all.length, 2);
  const criticalOnly = store.getEvents({ state: 'CRITICAL' });
  assert.strictEqual(criticalOnly.length, 1);
  assert.strictEqual(criticalOnly[0].title, 'Critical Event');
});
