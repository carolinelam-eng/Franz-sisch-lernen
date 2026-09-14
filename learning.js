const removePunctuation = (value) => value.replace(/[.,!?;:„“"'’()[\]{}]/g, ' ');

export function normalizeAnswer(value = '') {
  return removePunctuation(String(value).toLocaleLowerCase('fr'))
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function evaluateAnswer(input, expected) {
  const normalizedInput = normalizeAnswer(input);
  const normalizedExpected = normalizeAnswer(expected);
  if (normalizedInput === normalizedExpected) return { correct: true, close: false };
  return {
    correct: false,
    close: Boolean(normalizedInput) && withoutAccents(normalizedInput) === withoutAccents(normalizedExpected),
  };
}

export function calculateXp({ correct, awarded, streak = 0 }) {
  if (awarded) return 0;
  if (!correct) return 2;
  return 10 + (streak >= 3 ? 2 : 0);
}

const getWrong = (item, direction) => item.stats?.[direction]?.wrong ?? 0;
const getCorrect = (item, direction) => item.stats?.[direction]?.correct ?? 0;

function rankItems(items, direction) {
  return [...items].sort((a, b) => {
    const scoreA = (a.difficulty ?? 1) * 3 + getWrong(a, direction) * 2 - getCorrect(a, direction);
    const scoreB = (b.difficulty ?? 1) * 3 + getWrong(b, direction) * 2 - getCorrect(b, direction);
    return scoreB - scoreA || a.id.localeCompare(b.id);
  });
}

function choiceOptions(items, current, direction) {
  const key = direction === 'fr-de' ? 'german' : 'french';
  const others = items.filter((item) => item.id !== current.id).map((item) => item[key]);
  const options = [current[key], ...others.slice(0, 3)];
  return options.sort((a, b) => a.localeCompare(b, 'de'));
}

export function buildQuestions(items, direction = 'mixed', mode = 'mix', count = 10) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const selectedDirection = direction === 'mixed' ? 'fr-de' : direction;
  const ranked = rankItems(items, selectedDirection).slice(0, Math.min(count, items.length));
  const modes = ['write', 'choice', 'listen'];

  return ranked.map((item, index) => {
    const questionDirection = direction === 'mixed' && index % 2 ? 'de-fr' : selectedDirection;
    const questionMode = mode === 'mix' ? modes[index % modes.length] : mode;
    const promptKey = questionDirection === 'fr-de' ? 'french' : 'german';
    const answerKey = questionDirection === 'fr-de' ? 'german' : 'french';
    return {
      itemId: item.id,
      direction: questionDirection,
      mode: questionMode,
      prompt: item[promptKey],
      answer: item[answerKey],
      example: item.example,
      options: questionMode === 'choice' ? choiceOptions(items, item, questionDirection) : [],
    };
  });
}

export function updateDirectionStats(item, direction, correct, now = new Date().toISOString()) {
  const existing = item.stats?.[direction] ?? { correct: 0, wrong: 0, streak: 0 };
  const nextStats = {
    ...existing,
    correct: existing.correct + (correct ? 1 : 0),
    wrong: existing.wrong + (correct ? 0 : 1),
    streak: correct ? existing.streak + 1 : 0,
  };
  const difficulty = correct
    ? Math.max(1, (item.difficulty ?? 1) - (nextStats.streak >= 3 ? 1 : 0))
    : Math.min(5, (item.difficulty ?? 1) + 1);
  const reviewDays = correct ? Math.min(14, Math.max(1, nextStats.streak * 2)) : 0;
  const nextReview = new Date(new Date(now).getTime() + reviewDays * 86400000).toISOString();

  return {
    ...item,
    difficulty,
    lastAsked: now,
    nextReview,
    stats: { ...item.stats, [direction]: nextStats },
  };
}
