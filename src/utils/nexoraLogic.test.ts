import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_AGENTS,
  INITIAL_CHATS,
  INITIAL_CRON_JOBS,
  INITIAL_DOCS,
  INITIAL_FILES,
  INITIAL_HEALTH_CHECKS,
  INITIAL_INTER_AGENT_LOGS,
  INITIAL_MISSIONS,
  ROLE_PRESETS,
} from '../data/seedData';
import {
  advanceMissionProgress,
  approveMissionPlan,
  calculateHealthSummary,
  createCustomAgent,
  createMission,
  deliverMissionReport,
  detectRiskyCommand,
  evaluateTerminalCommand,
  hireSpecialist,
  retireSpecialist,
  reviseMissionPlan,
  searchWorkspace,
} from './nexoraLogic';

test('seed workspace starts completely empty for agents, missions, crons, chats, logs while preserving docs', () => {
  assert.equal(INITIAL_AGENTS.length, 0);
  assert.equal(INITIAL_MISSIONS.length, 0);
  assert.equal(INITIAL_CRON_JOBS.length, 0);
  assert.equal(INITIAL_INTER_AGENT_LOGS.length, 0);
  assert.deepEqual(INITIAL_CHATS, {});
  assert.equal(INITIAL_DOCS.length, 6);
  assert.equal(
    INITIAL_FILES.some(
      (f) => f.path === '~/.hermes/SOUL.md' || f.path.includes('profiles/vps-guardian/'),
    ),
    false,
  );
});

test('mission lifecycle: create -> approve -> advance -> deliver works cleanly even with 0 agents', () => {
  const created = createMission(
    'Audit Backup Pipeline',
    'Verify nightly backup scripts and VPS disk snapshots',
    'deep_dive',
    INITIAL_MISSIONS,
    INITIAL_AGENTS,
  );
  assert.equal(created.stage, 'approval');
  assert.equal(created.reportLength, 'deep_dive');
  assert.deepEqual(created.assignedAgentIds, ['operator']);
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
  const created = createMission(
    'Security Check',
    'Inspect SSH hardening',
    'brief',
    [],
    INITIAL_AGENTS,
  );
  const revised = reviseMissionPlan([created], created.id, 'Focus on mobile notifications too');
  const updated = revised.find((m) => m.id === created.id)!;
  assert.equal(updated.stage, 'approval');
  assert.equal(updated.revisionNote, 'Focus on mobile notifications too');
});

test('hiring, custom creation, and retiring specialists work from 0 agents and never collide with Telegram core slugs', () => {
  assert.equal(ROLE_PRESETS.length, 14);
  const { agents: afterHire, hired } = hireSpecialist(INITIAL_AGENTS, ROLE_PRESETS[0]);
  assert.equal(afterHire.length, 1);
  assert.equal(hired.buildingName, ROLE_PRESETS[0].buildingName);
  assert.ok(hired.ringRadius > 4);

  // Attempting to create custom agents named "default" or "vps-guardian" gets safe isolated slugs
  const { hired: safeDefault } = createCustomAgent(afterHire, {
    name: 'default',
    buildingName: 'Test Desk',
    role: 'Tester',
    department: 'Ops',
    model: 'combo-best',
    archetype: 'ribbed_tower',
    soulSummary: 'Test soul',
    avatarUrl: hired.avatarUrl,
    tools: ['hermes_cli', 'hermes_skills'],
  });
  assert.notEqual(safeDefault.profileKey, 'default');
  assert.notEqual(safeDefault.profileKey, 'vps-guardian');

  // Retiring hired specialist returns cleanly to 0 agents
  const retireRes = retireSpecialist(afterHire, hired.id);
  assert.equal(retireRes.removed, true);
  assert.equal(retireRes.agents.length, 0);
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

test('global workspace search finds preserved docs and health summary works deterministically', () => {
  const hits = searchWorkspace('Tailscale', {
    agents: INITIAL_AGENTS,
    missions: INITIAL_MISSIONS,
    docs: INITIAL_DOCS,
    crons: INITIAL_CRON_JOBS,
    files: INITIAL_FILES,
  });
  assert.ok(hits.length >= 1);
  assert.ok(hits.some((h) => h.type === 'doc'));

  const health = calculateHealthSummary(INITIAL_HEALTH_CHECKS);
  assert.equal(health.passed, 21);
  assert.equal(health.total, 21);
  assert.equal(health.label, 'Optimal');
});
