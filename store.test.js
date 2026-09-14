import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  loadState,
  saveState,
  recordDailyActivity,
  addVocabList,
  addVocabItem,
  deleteVocabList,
  addXpToProfile,
} from '../js/store.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('createInitialState includes a ready-to-learn demo list', () => {
  const state = createInitialState();
  assert.ok(state.lists.length >= 1);
  assert.ok(state.items.length >= 8);
  assert.equal(state.version, 1);
});

test('saveState and loadState preserve user data', () => {
  const storage = memoryStorage();
  const state = createInitialState();
  state.profile.name = 'Léa';
  saveState(storage, state);
  assert.equal(loadState(storage).profile.name, 'Léa');
});

test('loadState recovers from invalid stored JSON', () => {
  const storage = memoryStorage({ 'vocab-solar-state': '{not-json' });
  assert.equal(loadState(storage).version, 1);
});

test('recordDailyActivity extends and resets a streak correctly', () => {
  const profile = { streak: 2, lastActivityDate: '2026-09-13' };
  assert.equal(recordDailyActivity(profile, '2026-09-14').streak, 3);
  assert.equal(recordDailyActivity(profile, '2026-09-16').streak, 1);
  assert.equal(recordDailyActivity(profile, '2026-09-13').streak, 2);
});

test('addXpToProfile resets the daily counter on a new day', () => {
  const profile = { streak: 2, lastActivityDate: '2026-09-13', dailyXp: 120, weeklyXp: 100, totalXp: 500 };
  const next = addXpToProfile(profile, 12, '2026-09-14');
  assert.equal(next.dailyXp, 12);
  assert.equal(next.weeklyXp, 112);
  assert.equal(next.totalXp, 512);
  assert.equal(next.streak, 3);
});

test('addXpToProfile accumulates XP on the same day', () => {
  const profile = { streak: 2, lastActivityDate: '2026-09-14', dailyXp: 120, weeklyXp: 100, totalXp: 500 };
  assert.equal(addXpToProfile(profile, 12, '2026-09-14').dailyXp, 132);
});

test('list and item actions validate required values', () => {
  const state = createInitialState();
  assert.throws(() => addVocabList(state, { name: ' ' }), /Name/);
  assert.throws(() => addVocabItem(state, state.lists[0].id, { french: '', german: 'Haus' }), /Französisch/);
});

test('deleting a list also deletes its vocabulary items', () => {
  let state = createInitialState();
  state = addVocabList(state, { name: 'Test' });
  const listId = state.lists.at(-1).id;
  state = addVocabItem(state, listId, { french: 'oui', german: 'ja' });
  state = deleteVocabList(state, listId);
  assert.equal(state.lists.some((list) => list.id === listId), false);
  assert.equal(state.items.some((item) => item.listId === listId), false);
});
