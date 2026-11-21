import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_AGENTS,
  INITIAL_CRON_JOBS,
  INITIAL_DOCS,
  INITIAL_FILES,
  INITIAL_HEALTH_CHECKS,
  INITIAL_MISSIONS,
  ROLE_PRESETS,
} from '../data/seedData';
import {
  advanceMissionProgress,
  approveMissionPlan,
  calculateHealthSummary,
  createMission,
  deliverMissionReport,
  detectRiskyCommand,
  evaluateTerminalCommand,
  hireSpecialist,
  retireSpecialist,
  reviseMissionPlan,
  searchWorkspace,
} from './nexoraLogic';

test('mission lifecycle: create -> approve -> advance -> deliver produces Doc', () => {
  const created = createMission(
    'Audit Backup Pipeline',
    'Verify nightly backup scripts and VPS disk snapshots',
    'deep_dive',
    INITIAL_MISSIONS,
    INITIAL_AGENTS,
  );
  assert.equal(created.stage, 'approval');
  assert.equal(created.reportLength, 'deep_dive');
  assert.ok(created.assignedAgentIds.includes('executor'));
  assert.equal(created.steps.length, 3);

  let list = [created, ...INITIAL_MISSIONS];
  list = approveMissionPlan(list, created.id);
  let current = list.find((m) => m.id === created.id)!;
  assert.equal(current.stage, 'in_progress');
  assert.equal(current.steps[0].status, 'running');

  // Advance through all 3 steps
  list = advanceMissionProgress(list, created.id);
  list = advanceMissionProgress(list, created.id);
  list = advanceMissionProgress(list, created.id);
  current = list.find((m) => m.id === created.id)!;
  assert.equal(current.stage, 'review');
  assert.ok(current.steps.every((s) => s.status === 'done'));

  const { mission: delivered, doc } = deliverMissionReport(current, INITIAL_AGENTS);
  assert.equal(delivered.stage, 'delivered');
  assert.equal(delivered.deliveredDocId, doc.id);
  assert.ok(doc.content.includes('Audit Backup Pipeline'));
  assert.ok(doc.wordCount > 20);
});

test('mission revision preserves approval gate with operator note', () => {
  const target = INITIAL_MISSIONS.find((m) => m.stage === 'approval')!;
  const revised = reviseMissionPlan(INITIAL_MISSIONS, target.id, 'Focus on mobile notifications too');
  const updated = revised.find((m) => m.id === target.id)!;
  assert.equal(updated.stage, 'approval');
  assert.equal(updated.revisionNote, 'Focus on mobile notifications too');
});

test('hiring and retiring specialists rebalances 3D city and protects Executor HQ', () => {
  assert.equal(ROLE_PRESETS.length, 14);
  const { agents: afterHire, hired } = hireSpecialist(INITIAL_AGENTS, ROLE_PRESETS[0]);
  assert.equal(afterHire.length, INITIAL_AGENTS.length + 1);
  assert.equal(hired.buildingName, 'Security Bastion');
  assert.ok(hired.ringRadius > 4);

  // Protecting HQ
  const hqAttempt = retireSpecialist(afterHire, 'executor');
  assert.equal(hqAttempt.removed, false);
  assert.equal(hqAttempt.agents.length, afterHire.length);

  // Retiring hired specialist
  const retireRes = retireSpecialist(afterHire, hired.id);
  assert.equal(retireRes.removed, true);
  assert.equal(retireRes.agents.length, INITIAL_AGENTS.length);
});

test('terminal evaluator handles safe Hermes commands and gates risky commands', () => {
  const statusRes = evaluateTerminalCommand('hermes status', INITIAL_AGENTS);
  assert.ok(statusRes.output.includes('100.72.221.36:9119'));
  assert.ok(!statusRes.requiresGate);

  const riskReason = detectRiskyCommand('sudo systemctl restart hermes');
  assert.ok(riskReason !== null);

  const gated = evaluateTerminalCommand('sudo systemctl restart hermes', INITIAL_AGENTS, false);
  assert.equal(gated.requiresGate, true);

  const approved = evaluateTerminalCommand('sudo systemctl restart hermes', INITIAL_AGENTS, true);
  assert.ok(approved.output.includes('GATE APPROVED'));
  assert.ok(!approved.requiresGate);
});

test('global workspace search and health summary work deterministically', () => {
  const hits = searchWorkspace('Tailscale', {
    agents: INITIAL_AGENTS,
    missions: INITIAL_MISSIONS,
    docs: INITIAL_DOCS,
    crons: INITIAL_CRON_JOBS,
    files: INITIAL_FILES,
  });
  assert.ok(hits.length >= 2);
  assert.ok(hits.some((h) => h.type === 'mission'));
  assert.ok(hits.some((h) => h.type === 'doc'));

  const health = calculateHealthSummary(INITIAL_HEALTH_CHECKS);
  assert.equal(health.passed, 21);
  assert.equal(health.total, 21);
  assert.equal(health.label, 'Optimal');
});
