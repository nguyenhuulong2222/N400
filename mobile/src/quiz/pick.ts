// pickQuestions — parity with `index.html` startQuiz (line 5510):
//   - Split bank into gradable MCQs vs info-card questions.
//   - Sample `cfg.askCount` from gradable (Fisher-Yates shuffle).
//   - Pick up to 2 info-card questions, inserted at positions 1 and
//     `floor(askCount/2)+1` of the gradable run (parity with web).
//   - First item is ALWAYS gradable.
//
// `getQuestionBankFromData` is the pure per-route filter (no module-level
// state) so the smoke runner can exercise the algorithm without importing
// the data loader (which depends on a static JSON module import).

import type { AppData, Question, RouteKey, Rng } from '../types/quiz';
import { isInfoCardQuestion } from './resolve.ts';

export type PickOptions = {
  rng?: Rng;
};

export function getQuestionBankFromData(
  routeKey: RouteKey,
  appData: AppData,
): Question[] {
  const bank2025 = appData.questions2025.filter((q) => !q.excluded);
  const bank2008 = appData.questions2008.filter((q) => !q.excluded);
  switch (routeKey) {
    case '2025':
      return bank2025;
    case '2008':
      return bank2008;
    case '6520_2025':
      return bank2025.filter((q) => q.starred_6520 === true);
    case '6520_2008':
      return bank2008.filter((q) => q.starred_6520 === true);
    case '5020':
      return bank2025;
    case '5515':
      return bank2025;
  }
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = a[i] as T;
    const aj = a[j] as T;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

export function pickQuestions(
  routeKey: RouteKey,
  appData: AppData,
  options: PickOptions = {},
): Question[] {
  const rng = options.rng ?? Math.random;
  const cfg = appData.routeConfig[routeKey];
  if (!cfg) {
    throw new Error(`pickQuestions: unknown routeKey "${routeKey}"`);
  }
  const pool = getQuestionBankFromData(routeKey, appData);
  const gradablePool = pool.filter((q) => !isInfoCardQuestion(q));
  const infoPool = pool.filter((q) => isInfoCardQuestion(q));
  const gradable = shuffle(gradablePool, rng).slice(0, cfg.askCount);
  const k = Math.min(2, infoPool.length);
  const infoSample = shuffle(infoPool, rng).slice(0, k);
  const midGradeIdx = Math.floor(cfg.askCount / 2);

  const sequence: Question[] = [];
  for (let i = 0; i < gradable.length; i++) {
    sequence.push(gradable[i] as Question);
    if (i === 0 && infoSample[0]) sequence.push(infoSample[0]);
    if (i === midGradeIdx && infoSample[1]) sequence.push(infoSample[1]);
  }
  return sequence;
}
