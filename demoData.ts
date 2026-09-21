export const DEMO_LISTS = [
  {
    id: 'list-school',
    name: 'Schule & Alltag',
    description: 'Wichtige Wörter für den Unterricht und den Schulalltag',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

const words = [
  ['v1', 'le livre', 'das Buch', 'Je lis un livre.'],
  ['v2', 'la maison', 'das Haus', 'Voici la maison.'],
  ['v3', "l'école", 'die Schule', "L'école commence à huit heures."],
  ['v4', 'apprendre', 'lernen', "J'aime apprendre le français."],
  ['v5', 'écrire', 'schreiben', "J'écris une phrase."],
  ['v6', 'écouter', 'zuhören', "J'écoute le professeur."],
  ['v7', 'la question', 'die Frage', "J'ai une question."],
  ['v8', 'la réponse', 'die Antwort', 'Je connais la réponse.'],
  ['v9', 'rapide', 'schnell', 'Il parle très vite.'],
  ['v10', 'ensemble', 'zusammen', 'Nous apprenons ensemble.'],
  ['v11', 'comprendre', 'verstehen', 'Je comprends le texte.'],
  ['v12', 'répéter', 'wiederholen', 'Peux-tu répéter ?'],
];

export const DEMO_ITEMS = words.map(([id, french, german, example], index) => ({
  id,
  listId: 'list-school',
  french,
  german,
  example,
  difficulty: index < 4 ? 2 : 1,
  lastAsked: null,
  nextReview: null,
  stats: {},
}));

export const CLASS_PREVIEW = {
  id: 'class-7b',
  name: 'Französisch 7b',
  inviteCode: 'SOLEIL-7B',
  weeklyGoal: 10000,
  members: [
    { id: 'm1', name: 'Mila', xp: 1510 },
    { id: 'm2', name: 'Noah', xp: 1365 },
    { id: 'self', name: 'Du', xp: 1280 },
    { id: 'm3', name: 'Lina', xp: 1040 },
    { id: 'm4', name: 'Elias', xp: 860 },
  ],
};

export const OCR_DEMO_ITEMS = [
  { french: 'la famille', german: 'die Familie', example: "J'aime ma famille." },
  { french: 'le frère', german: 'der Bruder', example: "J'ai un frère." },
  { french: 'la sœur', german: 'die Schwester', example: "Elle a une sœur." },
  { french: 'les parents', german: 'die Eltern', example: 'Mes parents sont ici.' },
];
