import type {
  AnswerResult,
  Direction,
  LegacyVocabItem,
  PracticeDirection,
  PracticeMode,
  Question,
  QuestionMode,
} from "../legacyTypes";

const removePunctuation = (value: string): string => value.replace(/[.,!?;:„“"'’()[\]{}]/g, " ");

export function normalizeAnswer(value: string = ""): string {
  return removePunctuation(String(value).toLocaleLowerCase("fr"))
    .replace(/\s+/g, " ")
    .trim();
}

function withoutAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function evaluateAnswer(input: string, expected: string): AnswerResult {
  const normalizedInput = normalizeAnswer(input);
  const normalizedExpected = normalizeAnswer(expected);
  if (normalizedInput === normalizedExpected) return { correct: true, close: false };
  return {
    correct: false,
    close: Boolean(normalizedInput) && withoutAccents(normalizedInput) === withoutAccents(normalizedExpected),
  };
}

export function calculateXp({
  correct,
  awarded,
  streak = 0,
}: {
  correct: boolean;
  awarded: boolean;
  streak?: number;
}): number {
  if (awarded) return 0;
  if (!correct) return 2;
  return 10 + (streak >= 3 ? 2 : 0);
}

const getWrong = (item: LegacyVocabItem, direction: Direction): number => item.stats[direction]?.wrong ?? 0;
const getCorrect = (item: LegacyVocabItem, direction: Direction): number => item.stats[direction]?.correct ?? 0;

function rankItems(items: LegacyVocabItem[], direction: Direction): LegacyVocabItem[] {
  return [...items].sort((a, b) => {
    const scoreA = (a.difficulty ?? 1) * 3 + getWrong(a, direction) * 2 - getCorrect(a, direction);
    const scoreB = (b.difficulty ?? 1) * 3 + getWrong(b, direction) * 2 - getCorrect(b, direction);
    return scoreB - scoreA || a.id.localeCompare(b.id);
  });
}

function choiceOptions(items: LegacyVocabItem[], current: LegacyVocabItem, direction: Direction): string[] {
  const answer = direction === "fr-de" ? current.german : current.french;
  const others = items
    .filter((item) => item.id !== current.id)
    .map((item) => direction === "fr-de" ? item.german : item.french);
  return [answer, ...others.slice(0, 3)].sort((a, b) => a.localeCompare(b, "de"));
}

export function buildQuestions(
  items: LegacyVocabItem[],
  direction: PracticeDirection = "mixed",
  mode: PracticeMode = "mix",
  count = 10,
): Question[] {
  if (!items.length) return [];
  const selectedDirection: Direction = direction === "mixed" ? "fr-de" : direction;
  const ranked = rankItems(items, selectedDirection).slice(0, Math.min(count, items.length));
  const modes: QuestionMode[] = ["write", "choice", "listen"];

  return ranked.map((item, index) => {
    const questionDirection: Direction = direction === "mixed" && index % 2 ? "de-fr" : selectedDirection;
    const questionMode: QuestionMode = mode === "mix" ? modes[index % modes.length]! : mode;
    return {
      itemId: item.id,
      direction: questionDirection,
      mode: questionMode,
      prompt: questionDirection === "fr-de" ? item.french : item.german,
      answer: questionDirection === "fr-de" ? item.german : item.french,
      example: item.example,
      options: questionMode === "choice" ? choiceOptions(items, item, questionDirection) : [],
    };
  });
}

export function updateDirectionStats(
  item: LegacyVocabItem,
  direction: Direction,
  correct: boolean,
  now = new Date().toISOString(),
): LegacyVocabItem {
  const existing = item.stats[direction] ?? { correct: 0, wrong: 0, streak: 0 };
  const nextStats = {
    correct: existing.correct + (correct ? 1 : 0),
    wrong: existing.wrong + (correct ? 0 : 1),
    streak: correct ? existing.streak + 1 : 0,
  };
  const difficulty = correct
    ? Math.max(1, (item.difficulty ?? 1) - (nextStats.streak >= 3 ? 1 : 0))
    : Math.min(5, (item.difficulty ?? 1) + 1);
  const reviewDays = correct ? Math.min(14, Math.max(1, nextStats.streak * 2)) : 0;
  const nextReview = new Date(new Date(now).getTime() + reviewDays * 86_400_000).toISOString();

  return {
    ...item,
    difficulty,
    lastAsked: now,
    nextReview,
    stats: { ...item.stats, [direction]: nextStats },
  };
}
