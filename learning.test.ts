import { expect, test } from "vitest";
import {
  normalizeAnswer,
  evaluateAnswer,
  calculateXp,
  buildQuestions,
  updateDirectionStats,
} from "../../src/domain/learning";

const items = [
  { id: "v1", listId: "test", french: "la maison", german: "das Haus", example: "Voici la maison.", difficulty: 1, lastAsked: null, nextReview: null, stats: {} },
  { id: "v2", listId: "test", french: "le livre", german: "das Buch", example: "Je lis un livre.", difficulty: 1, lastAsked: null, nextReview: null, stats: {} },
  { id: "v3", listId: "test", french: "apprendre", german: "lernen", example: "J'aime apprendre.", difficulty: 1, lastAsked: null, nextReview: null, stats: {} },
  { id: "v4", listId: "test", french: "rapide", german: "schnell", example: "Il est rapide.", difficulty: 1, lastAsked: null, nextReview: null, stats: {} },
];

test("normalizeAnswer ignores case, punctuation and repeated spaces", () => {
  expect(normalizeAnswer("  Das   Haus! ")).toBe("das haus");
});

test("evaluateAnswer distinguishes exact, accent hint and incorrect answers", () => {
  expect(evaluateAnswer("école", "école")).toEqual({ correct: true, close: false });
  expect(evaluateAnswer("ecole", "école")).toEqual({ correct: false, close: true });
  expect(evaluateAnswer("livre", "école")).toEqual({ correct: false, close: false });
});

test("calculateXp awards points once for a completed answer", () => {
  expect(calculateXp({ correct: true, awarded: false, streak: 4 })).toBe(12);
  expect(calculateXp({ correct: false, awarded: false, streak: 4 })).toBe(2);
  expect(calculateXp({ correct: true, awarded: true, streak: 4 })).toBe(0);
});

test("buildQuestions creates both translation directions", () => {
  const fr = buildQuestions(items, "fr-de", "write", 3);
  const de = buildQuestions(items, "de-fr", "write", 3);
  expect(fr).toHaveLength(3);
  expect(fr[0]?.prompt).toBe(items.find((item) => item.id === fr[0]?.itemId)?.french);
  expect(de[0]?.prompt).toBe(items.find((item) => item.id === de[0]?.itemId)?.german);
});

test("multiple choice questions have unique options including the answer", () => {
  const question = buildQuestions(items, "fr-de", "choice", 1)[0];
  expect(question).toBeDefined();
  expect(new Set(question?.options).size).toBe(question?.options.length);
  expect(question?.options).toContain(question?.answer);
});

test("updateDirectionStats keeps direction results separate", () => {
  const updated = updateDirectionStats(items[0]!, "fr-de", false, "2026-09-14T10:00:00.000Z");
  expect(updated.stats["fr-de"]?.wrong).toBe(1);
  expect(updated.stats["fr-de"]?.correct).toBe(0);
  expect(updated.stats["de-fr"]).toBeUndefined();
  expect(updated.difficulty).toBe(2);
});
