import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_AGENTS, INITIAL_HEALTH_CHECKS } from '../data/seedData.ts';
import type { BridgeTelemetry } from '../types/nexora.ts';
import { mergeBridgeTelemetry, normalizeBridgeBaseUrl } from './nexoraBridge.ts';

const SAMPLE_TELEMETRY: BridgeTelemetry = {
  timestamp: '21:30:00',
  connected: true,
  host: 'hermesagent (100.72.221.36)',
  command_node: {
    host: 'vm-23-58-ubuntu (VPS 2)',
    cpu_percent: 6.4,
    cpu_cores: 2,
    ram_used_gb: 0.42,
    ram_total_gb: 4,
  },
  cpu: { percent: 22.5, cores: 4 },
  ram: { used_gb: 4.8, total_gb: 23.4, percent: 20.5 },
  disk: { used_gb: 19.2, total_gb: 193, percent: 9.9 },
  vps_alert: false,
  services: [
    { name: 'hermes-gateway', unit: 'hermes-gateway', state: 'active', healthy: true, latency_ms: 2 },
    { name: '9router (:20128)', unit: '9router', state: 'active', healthy: true, latency_ms: 14 },
    { name: 'voicestudio (:3900)', unit: 'voicestudio', state: 'down', healthy: false, latency_ms: 0 },
  ],
  agents: [
    {
      id: 'default',
      name: 'default',
      role: 'Primary Hermes HQ Orchestrator',
      model: 'combo-best',
      arch: 'hq_spire',
      soul: '# SOUL.md Live',
      status: 'EXECUTING',
      task: '9ROUTER: combo-best',
      is_core: true,
    },
    {
      id: 'vps-guardian',
      name: 'vps-guardian',
      role: 'Systemd Sentinel & Watchdog',
      model: 'combo-best',
      arch: 'care_pavilion',
      soul: '# Guardian Live',
      status: 'ALERT',
      task: 'ALERT: voicestudio (:3900)',
      is_core: true,
    },
    {
      id: 'alpha-trader',
      name: 'alpha-trader',
      role: 'Market Watcher',
      model: 'combo-best',
      arch: 'twin_towers',
      soul: '# Trader',
      status: 'IDLE',
      task: 'STANDBY',
    },
  ],
  pending_approvals: [],
  blackbox: [
    {
      id: 'b1',
      time: '21:29:59',
      agent: 'default',
      category: '9ROUTER',
      action: 'INFERENCE',
      detail: 'combo-best dispatched',
      level: 'INFO',
    },
  ],
};

test('mergeBridgeTelemetry reconciles real VPS profiles in hybrid and strict modes', () => {
  const hybrid = mergeBridgeTelemetry(
    SAMPLE_TELEMETRY,
    INITIAL_AGENTS,
    INITIAL_HEALTH_CHECKS,
    false,
  );
  // 12 initial towers + 1 new custom VPS profile (alpha-trader)
  assert.equal(hybrid.agents.length, 13);
  const hq = hybrid.agents.find((a) => a.isHQ);
  assert.equal(hq?.status, 'working');
  assert.equal(hq?.currentTask, '9ROUTER: combo-best');

  const guardian = hybrid.agents.find((a) => a.profileKey === 'vps-guardian');
  assert.equal(guardian?.status, 'alert');

  const voiceCheck = hybrid.healthChecks.find((c) => c.name.includes('VoiceStudio'));
  assert.equal(voiceCheck?.status, 'fail');

  const strict = mergeBridgeTelemetry(
    SAMPLE_TELEMETRY,
    INITIAL_AGENTS,
    INITIAL_HEALTH_CHECKS,
    true,
  );
  assert.equal(strict.agents.length, 3);
  const alphaTrader = strict.agents.find((a) => a.profileKey === 'alpha-trader');
  assert.ok(alphaTrader?.avatarUrl.startsWith('/src/assets/images/avatar_'));
  assert.notEqual(alphaTrader?.avatarUrl, hq?.avatarUrl);
  assert.equal(strict.interAgentLogs.length, 1);
  assert.equal(strict.interAgentLogs[0].fromAgentId, 'executor');
});

test('normalizeBridgeBaseUrl trims trailing slashes cleanly', () => {
  assert.equal(normalizeBridgeBaseUrl('http://100.85.109.20:9120///'), 'http://100.85.109.20:9120');
  assert.equal(normalizeBridgeBaseUrl('   '), '');
});

test('mergeBridgeTelemetry suppresses tombstoned deleted profiles from stale in-flight snapshots', () => {
  const excluded = new Set(['alpha-trader', 'vps-alpha-trader']);
  const strict = mergeBridgeTelemetry(
    SAMPLE_TELEMETRY,
    INITIAL_AGENTS,
    INITIAL_HEALTH_CHECKS,
    true,
    excluded,
  );
  assert.equal(strict.agents.length, 2);
  assert.equal(strict.agents.some((a) => a.profileKey === 'alpha-trader'), false);

  const hybrid = mergeBridgeTelemetry(
    SAMPLE_TELEMETRY,
    INITIAL_AGENTS,
    INITIAL_HEALTH_CHECKS,
    false,
    excluded,
  );
  assert.equal(hybrid.agents.some((a) => a.profileKey === 'alpha-trader'), false);
});

