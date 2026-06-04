// buildQuizViewModel — turns a resolved MCQ question into the shape the
// UI consumes: 4 options (1 accepted + 3 distractors) shuffled into a
// stable order with a `correctIndex`. Returns `null` when the source
// question fails preconditions (no accepted answers, <3 distractors, or
// any field is missing / non-string). UI must render a safe error card
// when null is returned — never silently advance.
//
// Pass an `rng` for deterministic ordering (smoke runner uses this).

import type {
  Question,
  QuizQuestionViewModel,
  Rng,
} from '../types/quiz.ts';

export type ResolvedMcqInput = {
  question: Question;
  accepted: string[];
  distractors: string[];
};

export type BuildViewModelOptions = {
  rng?: Rng;
};

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

function pickN<T>(arr: readonly T[], n: number, rng: Rng): T[] {
  const copy = arr.slice();
  shuffleInPlace(copy, rng);
  return copy.slice(0, n);
}

export function buildQuizViewModel(
  resolved: ResolvedMcqInput,
  options: BuildViewModelOptions = {},
): QuizQuestionViewModel | null {
  const rng = options.rng ?? Math.random;
  if (
    !resolved ||
    !resolved.question ||
    typeof resolved.question.id !== 'number' ||
    Number.isNaN(resolved.question.id) ||
    typeof resolved.question.q !== 'string' ||
    resolved.question.q.length === 0 ||
    !Array.isArray(resolved.accepted) ||
    resolved.accepted.length === 0 ||
    !Array.isArray(resolved.distractors) ||
    resolved.distractors.length < 3
  ) {
    return null;
  }
  const accepted = resolved.accepted.filter(
    (s) => typeof s === 'string' && s.length > 0,
  );
  const distractors = resolved.distractors.filter(
    (s) => typeof s === 'string' && s.length > 0,
  );
  if (accepted.length === 0 || distractors.length < 3) return null;

  const chosenAccepted = pickN(accepted, 1, rng)[0] as string;
  const chosenDistractors = pickN(distractors, 3, rng);
  const opts = shuffleInPlace(
    [chosenAccepted, ...chosenDistractors],
    rng,
  );
  if (opts.length !== 4) return null;
  for (const o of opts) {
    if (typeof o !== 'string' || o.length === 0) return null;
  }
  const correctIndex = opts.indexOf(chosenAccepted);
  if (correctIndex < 0 || correctIndex > 3) return null;

  return {
    id: resolved.question.id,
    prompt: resolved.question.q,
    options: opts,
    correctIndex,
    acceptedAnswers: accepted,
  };
}
