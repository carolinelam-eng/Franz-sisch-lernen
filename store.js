import { CLASS_PREVIEW, DEMO_ITEMS, DEMO_LISTS } from './data.js';

export const STORAGE_KEY = 'vocab-solar-state';

const copy = (value) => JSON.parse(JSON.stringify(value));
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createInitialState() {
  return {
    version: 1,
    profile: {
      id: 'local-user',
      name: 'Léa',
      streak: 7,
      lastActivityDate: null,
      totalXp: 3480,
      weeklyXp: 1280,
      dailyXp: 120,
      dailyGoal: 150,
    },
    lists: copy(DEMO_LISTS),
    items: copy(DEMO_ITEMS),
    sessions: [],
    classPreview: copy(CLASS_PREVIEW),
    activeListId: DEMO_LISTS[0].id,
  };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.lists) || !Array.isArray(parsed.items)) {
      return createInitialState();
    }
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function saveState(storage = globalThis.localStorage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function recordDailyActivity(profile, date) {
  if (!date || !profile.lastActivityDate) return { ...profile, streak: profile.lastActivityDate ? profile.streak : 1, lastActivityDate: date };
  if (date <= profile.lastActivityDate) return { ...profile };
  const prior = new Date(`${profile.lastActivityDate}T00:00:00Z`);
  const current = new Date(`${date}T00:00:00Z`);
  const days = Math.round((current - prior) / 86400000);
  return { ...profile, streak: days === 1 ? profile.streak + 1 : 1, lastActivityDate: date };
}

export function addXpToProfile(profile, xp, date) {
  const isNewDay = profile.lastActivityDate !== date;
  return recordDailyActivity({
    ...profile,
    totalXp: profile.totalXp + xp,
    weeklyXp: profile.weeklyXp + xp,
    dailyXp: (isNewDay ? 0 : profile.dailyXp) + xp,
  }, date);
}

export function addVocabList(state, input) {
  const name = input.name?.trim();
  if (!name) throw new Error('Name der Liste fehlt.');
  const now = new Date().toISOString();
  const list = { id: makeId('list'), name, description: input.description?.trim() ?? '', createdAt: now, updatedAt: now };
  return { ...state, lists: [...state.lists, list], activeListId: list.id };
}

export function updateVocabList(state, listId, input) {
  const name = input.name?.trim();
  if (!name) throw new Error('Name der Liste fehlt.');
  return {
    ...state,
    lists: state.lists.map((list) => list.id === listId
      ? { ...list, name, description: input.description?.trim() ?? '', updatedAt: new Date().toISOString() }
      : list),
  };
}

export function deleteVocabList(state, listId) {
  const lists = state.lists.filter((list) => list.id !== listId);
  return {
    ...state,
    lists,
    items: state.items.filter((item) => item.listId !== listId),
    activeListId: state.activeListId === listId ? lists[0]?.id ?? null : state.activeListId,
  };
}

export function addVocabItem(state, listId, input) {
  const french = input.french?.trim();
  const german = input.german?.trim();
  if (!french) throw new Error('Französisch darf nicht leer sein.');
  if (!german) throw new Error('Die deutsche Übersetzung darf nicht leer sein.');
  if (!state.lists.some((list) => list.id === listId)) throw new Error('Die gewählte Liste wurde nicht gefunden.');
  const item = {
    id: makeId('vocab'), listId, french, german, example: input.example?.trim() ?? '',
    difficulty: 1, lastAsked: null, nextReview: null, stats: {},
  };
  return { ...state, items: [...state.items, item], activeListId: listId };
}

export function updateVocabItem(state, itemId, input) {
  const french = input.french?.trim();
  const german = input.german?.trim();
  if (!french || !german) throw new Error('Französisch und Deutsch müssen ausgefüllt sein.');
  return { ...state, items: state.items.map((item) => item.id === itemId ? { ...item, french, german, example: input.example?.trim() ?? '' } : item) };
}

export function deleteVocabItem(state, itemId) {
  return { ...state, items: state.items.filter((item) => item.id !== itemId) };
}
