// resolveQuestion — classifies a question for the runtime UI.
//
// Web parity reference (`index.html` line 5614 `resolveQuestion` +
// line 5594 `isInfoCardQuestion`):
//   - dynamic + officialField  → info-card (President / VP / Speaker / CJ)
//   - stateField === 'senators' → info-card (per-state lookup)
//   - stateField === 'governor' → info-card (per-state lookup)
//   - stateField === 'capital'  → MCQ with state-substituted accepted +
//                                  generated distractors (needs userState)
//   - everything else          → MCQ from baked `a` / `distractors`
//
// Phase 3A returns a tagged union instead of mutating-and-returning the
// question. Dynamic/info-card variants never hardcode officeholder names
// (Invariant IV); state-resolved questions are flagged `needsState` for
// Phase 3B to wire up.

import type { Question, ResolvedQuestion } from '../types/quiz';

export type ResolveOptions = {
  // Reserved for Phase 3B (userState selection). Phase 3A does not consume.
  userState?: string;
};

export function isInfoCardQuestion(q: Question): boolean {
  if (q.dynamic === true && typeof q.officialField === 'string') return true;
  if (q.stateField === 'senators') return true;
  if (q.stateField === 'governor') return true;
  return false;
}

export function resolveQuestion(
  q: Question,
  _options: ResolveOptions = {},
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
    return { kind: 'needsState', question: q, stateField: 'capital' };
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
