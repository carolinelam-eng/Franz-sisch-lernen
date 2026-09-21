import { CLASS_PREVIEW, DEMO_ITEMS, DEMO_LISTS } from "../demoData";
import type {
  LegacyProfile,
  LegacyState,
  LegacyVocabItem,
  LegacyVocabList,
  ListInput,
  VocabularyInput,
} from "../legacyTypes";

export const STORAGE_KEY = "vocab-solar-state";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const makeId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyState(value: unknown): value is LegacyState {
  return isRecord(value)
    && value.version === 1
    && Array.isArray(value.lists)
    && Array.isArray(value.items)
    && isRecord(value.profile)
    && isRecord(value.classPreview);
}

export function createInitialState(): LegacyState {
  return {
    version: 1,
    profile: {
      id: "local-user",
      name: "Léa",
      streak: 7,
      lastActivityDate: null,
      totalXp: 3480,
      weeklyXp: 1280,
      dailyXp: 120,
      dailyGoal: 150,
    },
    lists: copy(DEMO_LISTS) as LegacyVocabList[],
    items: copy(DEMO_ITEMS) as LegacyVocabItem[],
    sessions: [],
    classPreview: copy(CLASS_PREVIEW),
    activeListId: DEMO_LISTS[0]?.id ?? null,
  };
}

export function loadState(storage: Storage | undefined = globalThis.localStorage): LegacyState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed: unknown = JSON.parse(raw);
    return isLegacyState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(storage: Storage | undefined, state: LegacyState): LegacyState {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

interface StreakProfile {
  streak: number;
  lastActivityDate: string | null;
}

export function recordDailyActivity<T extends StreakProfile>(profile: T, date: string): T {
  if (!date || !profile.lastActivityDate) {
    return { ...profile, streak: profile.lastActivityDate ? profile.streak : 1, lastActivityDate: date };
  }
  if (date <= profile.lastActivityDate) return { ...profile };
  const prior = new Date(`${profile.lastActivityDate}T00:00:00Z`);
  const current = new Date(`${date}T00:00:00Z`);
  const days = Math.round((current.getTime() - prior.getTime()) / 86_400_000);
  return { ...profile, streak: days === 1 ? profile.streak + 1 : 1, lastActivityDate: date };
}

type XpProfile = StreakProfile & Pick<LegacyProfile, "totalXp" | "weeklyXp" | "dailyXp">;

export function addXpToProfile<T extends XpProfile>(profile: T, xp: number, date: string): T {
  const isNewDay = profile.lastActivityDate !== date;
  return recordDailyActivity({
    ...profile,
    totalXp: profile.totalXp + xp,
    weeklyXp: profile.weeklyXp + xp,
    dailyXp: (isNewDay ? 0 : profile.dailyXp) + xp,
  }, date);
}

export function addVocabList(state: LegacyState, input: ListInput): LegacyState {
  const name = input.name?.trim();
  if (!name) throw new Error("Name der Liste fehlt.");
  const now = new Date().toISOString();
  const list: LegacyVocabList = {
    id: makeId("list"),
    name,
    description: input.description?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  };
  return { ...state, lists: [...state.lists, list], activeListId: list.id };
}

export function updateVocabList(state: LegacyState, listId: string, input: ListInput): LegacyState {
  const name = input.name?.trim();
  if (!name) throw new Error("Name der Liste fehlt.");
  return {
    ...state,
    lists: state.lists.map((list) => list.id === listId
      ? { ...list, name, description: input.description?.trim() ?? "", updatedAt: new Date().toISOString() }
      : list),
  };
}

export function deleteVocabList(state: LegacyState, listId: string): LegacyState {
  const lists = state.lists.filter((list) => list.id !== listId);
  return {
    ...state,
    lists,
    items: state.items.filter((item) => item.listId !== listId),
    activeListId: state.activeListId === listId ? lists[0]?.id ?? null : state.activeListId,
  };
}

export function addVocabItem(state: LegacyState, listId: string, input: VocabularyInput): LegacyState {
  const french = input.french?.trim();
  const german = input.german?.trim();
  if (!french) throw new Error("Französisch darf nicht leer sein.");
  if (!german) throw new Error("Die deutsche Übersetzung darf nicht leer sein.");
  if (!state.lists.some((list) => list.id === listId)) throw new Error("Die gewählte Liste wurde nicht gefunden.");
  const item: LegacyVocabItem = {
    id: makeId("vocab"),
    listId,
    french,
    german,
    example: input.example?.trim() ?? "",
    difficulty: 1,
    lastAsked: null,
    nextReview: null,
    stats: {},
  };
  return { ...state, items: [...state.items, item], activeListId: listId };
}

export function updateVocabItem(state: LegacyState, itemId: string, input: VocabularyInput): LegacyState {
  const french = input.french?.trim();
  const german = input.german?.trim();
  if (!french || !german) throw new Error("Französisch und Deutsch müssen ausgefüllt sein.");
  return {
    ...state,
    items: state.items.map((item) => item.id === itemId
      ? { ...item, french, german, example: input.example?.trim() ?? "" }
      : item),
  };
}

export function deleteVocabItem(state: LegacyState, itemId: string): LegacyState {
  return { ...state, items: state.items.filter((item) => item.id !== itemId) };
}
