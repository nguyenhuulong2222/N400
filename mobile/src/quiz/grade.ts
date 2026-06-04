// Bidirectional-substring grader — exact parity with `index.html` line 6062:
//
//   q.a.some(a => norm(chosen).includes(norm(a)) || norm(a).includes(norm(chosen)))
//
// Either direction counts: the chosen answer matches when the normalized
// form contains, or is contained by, any normalized accepted answer.
// Callers must pass a question whose `a` is the *resolved* accepted list —
// see resolveQuestion.

import type { Question } from '../types/quiz';
import { norm } from './normalize.ts';

export function gradeAnswer(chosen: string, question: Question): boolean {
  const accepted = question.a;
  if (!Array.isArray(accepted) || accepted.length === 0) return false;
  const n = norm(chosen);
  if (n.length === 0) return false;
  return accepted.some((a) => {
    const na = norm(a);
    if (na.length === 0) return false;
    return n.includes(na) || na.includes(n);
  });
}
