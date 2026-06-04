// buildQuizViewModel — turns a resolved MCQ question into the shape the
// UI consumes: 4 options (1 accepted + 3 distractors) shuffled into a
// stable order with a `correctIndex`. Each option carries the English
// string (used by the grader) and an optional localized string (used for
// display). Returns `null` when the source question fails preconditions
// (no accepted answers, <3 distractors, missing fields) — UI must render
// a safe error card when null is returned.
//
// Index alignment is the load-bearing contract: when we randomly pick
// `accepted[i]` or `distractors[j]`, we look up the localized parallel
// array at the same index. Web parity.
//
// Pass `lang` to localize displayed text. Grading is always English.

import {
  getAccepted,
  getDistractors,
  getPrompt,
} from '../i18n/localize.ts';
import type {
  DisplayText,
  LangCode,
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
  lang?: LangCode;
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

type Descriptor = {
  english: string;
  source: 'accepted' | 'distractor';
  index: number;
};

export function buildQuizViewModel(
  resolved: ResolvedMcqInput,
  options: BuildViewModelOptions = {},
): QuizQuestionViewModel | null {
  const rng = options.rng ?? Math.random;
  const lang: LangCode = options.lang ?? 'en';
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

  // Identify usable English source-array indices (skip empty / non-string).
  const acceptedIdxs: number[] = [];
  for (let i = 0; i < resolved.accepted.length; i++) {
    const s = resolved.accepted[i];
    if (typeof s === 'string' && s.length > 0) acceptedIdxs.push(i);
  }
  const distractorIdxs: number[] = [];
  for (let i = 0; i < resolved.distractors.length; i++) {
    const s = resolved.distractors[i];
    if (typeof s === 'string' && s.length > 0) distractorIdxs.push(i);
  }
  if (acceptedIdxs.length === 0 || distractorIdxs.length < 3) return null;

  // Pick 1 accepted + 3 distractor indices.
  const shuffledAccepted = acceptedIdxs.slice();
  shuffleInPlace(shuffledAccepted, rng);
  const chosenAcceptedIdx = shuffledAccepted[0] as number;

  const shuffledDistractors = distractorIdxs.slice();
  shuffleInPlace(shuffledDistractors, rng);
  const chosenDistractorIdxs = shuffledDistractors.slice(0, 3);

  // Localized parallel arrays — index-aligned with English.
  const localizedAccepted = getAccepted(resolved.question, lang);
  const localizedDistractors = getDistractors(resolved.question, lang);

  const descriptors: Descriptor[] = [
    {
      english: resolved.accepted[chosenAcceptedIdx] as string,
      source: 'accepted',
      index: chosenAcceptedIdx,
    },
    ...chosenDistractorIdxs.map<Descriptor>((i) => ({
      english: resolved.distractors[i] as string,
      source: 'distractor',
      index: i,
    })),
  ];

  shuffleInPlace(descriptors, rng);

  const opts: DisplayText[] = descriptors.map((d) => {
    const parallel =
      d.source === 'accepted' ? localizedAccepted : localizedDistractors;
    const lookup = parallel[d.index];
    if (!lookup) {
      return { english: d.english };
    }
    const out: DisplayText = { english: lookup.english };
    if (lookup.localized !== undefined) out.localized = lookup.localized;
    if (lookup.suggested === true) out.suggested = true;
    return out;
  });

  if (opts.length !== 4) return null;
  for (const o of opts) {
    if (typeof o.english !== 'string' || o.english.length === 0) return null;
  }
  const correctIndex = descriptors.findIndex((d) => d.source === 'accepted');
  if (correctIndex < 0 || correctIndex > 3) return null;

  const promptLocalized = getPrompt(resolved.question, lang);
  const prompt: DisplayText = { english: promptLocalized.english };
  if (promptLocalized.localized !== undefined) {
    prompt.localized = promptLocalized.localized;
  }
  if (promptLocalized.suggested === true) prompt.suggested = true;

  return {
    id: resolved.question.id,
    prompt,
    options: opts,
    correctIndex,
    acceptedAnswers: resolved.accepted,
  };
}
