// resolveQuestion — classifies a question for the runtime UI.
//
// Web parity reference (`index.html` line 5614 `resolveQuestion` +
// line 5594 `isInfoCardQuestion`):
//   - dynamic + officialField  → info-card (President / VP / Speaker / CJ)
//   - stateField === 'senators' → info-card (per-state lookup)
//   - stateField === 'governor' → info-card (per-state lookup)
//   - stateField === 'capital'  → MCQ with state-substituted accepted +
//                                  generated distractors (needs userState +
//                                  appData)
//   - everything else          → MCQ from baked `a` / `distractors`
//
// Phase 3C-B: capital questions resolve to `kind: 'mcq'` when the user
// has picked a state AND that state's capital is not a placeholder.
// Otherwise — and for DC, whose capital field is the literal string
// "D.C. is not a state and does not have a capital" — falls back to
// `kind: 'needsState'` so the UI renders a Study Card (not graded).
//
// Invariant IV: dynamic officeholder questions never resolve to MCQ —
// no hardcoded names, regardless of the data shipped.

import type {
  AppData,
  Question,
  ResolvedQuestion,
  Rng,
  USStateCode,
} from '../types/quiz.ts';

export type ResolveOptions = {
  userState?: USStateCode;
  appData?: AppData;
  rng?: Rng;
};

export function isInfoCardQuestion(q: Question): boolean {
  if (q.dynamic === true && typeof q.officialField === 'string') return true;
  if (q.stateField === 'senators') return true;
  if (q.stateField === 'governor') return true;
  return false;
}

// Web-parity placeholder filter — `index.html` line 5622.
function isStatePlaceholder(s: string): boolean {
  return (
    /D\.C\./.test(s) ||
    /does not have/.test(s) ||
    /no U\.S\./.test(s) ||
    /not a state/.test(s)
  );
}

function asStringArray(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  return [];
}

function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = arr[i] as T;
    const aj = arr[j] as T;
    arr[i] = aj;
    arr[j] = ai;
  }
  return arr;
}

export function resolveQuestion(
  q: Question,
  options: ResolveOptions = {},
): ResolvedQuestion {
  if (q.dynamic === true && typeof q.officialField === 'string') {
    return { kind: 'needsInfoCard', question: q, reason: 'dynamic-officeholder' };
  }
  if (q.stateField === 'senators') {
    return { kind: 'needsInfoCard', question: q, reason: 'state-senators' };
  }
  if (q.stateField === 'governor') {
    return { kind: 'needsInfoCard', question: q, reason: 'state-governor' };
  }
  if (q.stateField === 'capital') {
    return resolveCapital(q, options);
  }

  const accepted = Array.isArray(q.a) ? q.a : [];
  const distractors = Array.isArray(q.distractors) ? q.distractors : [];
  if (accepted.length === 0 || distractors.length < 3) {
    return {
      kind: 'unsupportedInPhase3A',
      question: q,
      reason:
        accepted.length === 0
          ? 'missing accepted answers'
          : `insufficient distractors (have ${distractors.length}, need >=3)`,
    };
  }
  return { kind: 'mcq', question: q, accepted, distractors };
}

function resolveCapital(
  q: Question,
  options: ResolveOptions,
): ResolvedQuestion {
  const userState = options.userState;
  const appData = options.appData;
  const rng = options.rng ?? Math.random;
  if (!userState || !appData) {
    return { kind: 'needsState', question: q, stateField: 'capital' };
  }
  const entry = appData.stateData[userState];
  if (!entry) {
    return { kind: 'needsState', question: q, stateField: 'capital' };
  }
  const rawAccepted = asStringArray(entry.capital).filter(
    (s) => !isStatePlaceholder(s),
  );
  if (rawAccepted.length === 0) {
    // e.g. DC: capital field is a placeholder string.
    return { kind: 'needsState', question: q, stateField: 'capital' };
  }

  // Build distractor pool from every OTHER state's capital, excluding
  // placeholders and anything already in `rawAccepted`.
  const pool: string[] = [];
  for (const [code, sd] of Object.entries(appData.stateData)) {
    if (code === userState) continue;
    const others = asStringArray(sd.capital);
    for (const item of others) {
      if (!item || isStatePlaceholder(item)) continue;
      if (rawAccepted.includes(item)) continue;
      if (pool.includes(item)) continue;
      pool.push(item);
    }
  }
  if (pool.length < 3) {
    // Cannot construct a 4-option MCQ — fall back to study card.
    return { kind: 'needsState', question: q, stateField: 'capital' };
  }
  shuffleInPlace(pool, rng);
  const distractors = pool.slice(0, 3);

  return {
    kind: 'mcq',
    question: q,
    accepted: rawAccepted,
    distractors,
  };
}
