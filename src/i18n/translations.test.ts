import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createI18nValue,
  OFFICE_IDLE_THOUGHTS,
  OFFICE_WORKING_THOUGHTS,
  TRANSLATIONS,
} from './translations';
import { INITIAL_AGENTS, INITIAL_DOCS, ROLE_PRESETS } from '../data/seedData';

test('TRANSLATIONS en and id have identical non-empty key sets', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  const idKeys = Object.keys(TRANSLATIONS.id).sort();
  assert.deepEqual(enKeys, idKeys, 'English and Indonesian translation keys must match 1:1');

  for (const key of enKeys as Array<keyof typeof TRANSLATIONS.en>) {
    assert.ok(TRANSLATIONS.en[key].trim().length > 0, `Empty en string for ${key}`);
    assert.ok(TRANSLATIONS.id[key].trim().length > 0, `Empty id string for ${key}`);
  }
});

test('AddAgentModal and workstation style copy contain zero legacy building/tower/island words', () => {
  const forbidden = /\b(tower|towers|island|observatory|dome|citadel|spire|gedung|menara|pulau)\b/i;
  for (const lang of ['en', 'id'] as const) {
    const dict = TRANSLATIONS[lang];
    for (const [key, val] of Object.entries(dict)) {
      if (key.startsWith('addModal') || key.startsWith('style')) {
        assert.equal(
          forbidden.test(val),
          false,
          `Legacy building word found in ${lang}.${key}: "${val}"`,
        );
      }
    }
  }
});

test('Indonesian seed overrides cover all default agents, presets, and docs', () => {
  const idI18n = createI18nValue('id');
  const enI18n = createI18nValue('en');

  for (const ag of INITIAL_AGENTS) {
    const idDisp = idI18n.agentDisplay(ag);
    assert.notEqual(
      idDisp.role,
      ag.role,
      `Expected Indonesian role translation for agent ${ag.id}`,
    );
  }

  for (const preset of ROLE_PRESETS) {
    const idPreset = idI18n.presetDisplay(preset);
    assert.notEqual(
      idPreset.description,
      preset.description,
      `Expected Indonesian description for preset ${preset.id}`,
    );
  }

  for (const doc of INITIAL_DOCS) {
    const idDoc = idI18n.docDisplay(doc);
    assert.notEqual(idDoc.title, doc.title, `Expected Indonesian title for ${doc.id}`);
    assert.notEqual(idDoc.content, doc.content, `Expected Indonesian body for ${doc.id}`);
    assert.equal(enI18n.docDisplay(doc).title, doc.title);
  }
});

test('3D office idle & working thoughts exist in both en and id', () => {
  for (const lang of ['en', 'id'] as const) {
    assert.ok(OFFICE_WORKING_THOUGHTS[lang].length >= 3);
    for (const key of Object.keys(OFFICE_IDLE_THOUGHTS[lang]) as Array<
      keyof (typeof OFFICE_IDLE_THOUGHTS)['en']
    >) {
      assert.ok(OFFICE_IDLE_THOUGHTS[lang][key].lines.length >= 3);
    }
  }
});
