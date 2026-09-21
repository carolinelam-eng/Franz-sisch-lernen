export type Direction = "fr-de" | "de-fr";
export type PracticeDirection = Direction | "mixed";
export type PracticeMode = "write" | "choice" | "listen" | "mix";
export type QuestionMode = Exclude<PracticeMode, "mix">;

export interface DirectionStats {
  correct: number;
  wrong: number;
  streak: number;
}

export interface LegacyVocabItem {
  id: string;
  listId: string;
  french: string;
  german: string;
  example: string;
  difficulty: number;
  lastAsked: string | null;
  nextReview: string | null;
  stats: Partial<Record<Direction, DirectionStats>>;
  imageUrl?: string | null;
  active?: boolean;
}

export interface LegacyVocabList {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  source?: "local" | "published";
  contentVersion?: number;
  active?: boolean;
}

export interface LegacyProfile {
  id: string;
  name: string;
  streak: number;
  lastActivityDate: string | null;
  totalXp: number;
  weeklyXp: number;
  dailyXp: number;
  dailyGoal: number;
}

export interface LegacySession {
  id: string;
  listId: string;
  mode: PracticeMode;
  direction: PracticeDirection;
  correct: number;
  wrong: number;
  xp: number;
  completedAt: string;
}

export interface ClassMember {
  id: string;
  name: string;
  xp: number;
}

export interface ClassPreview {
  id: string;
  name: string;
  inviteCode: string;
  weeklyGoal: number;
  members: ClassMember[];
}

export interface LegacyState {
  version: 1;
  profile: LegacyProfile;
  lists: LegacyVocabList[];
  items: LegacyVocabItem[];
  sessions: LegacySession[];
  classPreview: ClassPreview;
  activeListId: string | null;
}

export interface VocabularyInput {
  french?: string;
  german?: string;
  example?: string;
}

export interface ListInput {
  name?: string;
  description?: string;
}

export interface Question {
  itemId: string;
  direction: Direction;
  mode: QuestionMode;
  prompt: string;
  answer: string;
  example: string;
  options: string[];
}

export interface AnswerResult {
  correct: boolean;
  close: boolean;
}

export interface PracticeState {
  questions: Question[];
  index: number;
  correct: number;
  wrong: number;
  xp: number;
  answered: boolean;
  feedback: AnswerResult | null;
  correctStreak: number;
  mode: PracticeMode;
  direction: PracticeDirection;
  listId: string;
  complete: boolean;
}
