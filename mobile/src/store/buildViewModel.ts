// buildQuizViewModel — turns a resolved MCQ question into the shape the
// UI consumes: 4 options (1 accepted + 3 distractors) shuffled into a
// stable order with a `correctIndex`. Each option carries the English
// string (used by the grader) and an optional localized string (used for
// display). Returns `null` when the source question fails preconditions
// (no accepted answers, <3 distractors, missing fields) — UI must render
// a safe error card when null is returned.
//
// THE CORRECT OPTION IS ALWAYS INDEX 0 — exact parity with the web app
// (`index.html:6417` `const correctEn = q.a[0]` and `:6426`
// `correctOpt[L] = (q[L + '_a'] || [])[0]`).
//
// Do NOT pick a random index out of `accepted`. `a[]` and `<lang>_a[]` are
// NOT reliably index-aligned in the source data: 112 of 228 questions have
// differing lengths across the 13 non-English languages, and at indices > 0
// the entries frequently describe different facts. 2025 Q85 (Benjamin
// Franklin) is the canonical case — `a` has 9 entries, `vi_a` has 5, and
// `vi_a[1]` ("oldest member of the Constitutional Convention") does not
// correspond to `a[1]` ("Diplomat"). Picking index 3 there rendered a
// Vietnamese string under an unrelated English subtitle; picking index 5+
// rendered an English-only option among Vietnamese ones. Index 0 is the only
// position the data guarantees to be aligned, so index 0 is what we display.
//
// Distractors ARE index-aligned (verified: 0 length mismatches across every
// language), so they keep their random selection with parallel lookup.
//
// Localized fallback is ALL-OR-NOTHING per option: an option either shows
// localized-primary + English-subtitle, or English only. It never mixes a
// localized string with a non-corresponding English one.
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

  // The correct option is pinned to index 0 (see header). `a[0]` must be a
  // usable string; if it is not, the question cannot be rendered safely.
  const accepted0 = resolved.accepted[0];
  if (typeof accepted0 !== 'string' || accepted0.length === 0) return null;
  const chosenAcceptedIdx = 0;

  const distractorIdxs: number[] = [];
  for (let i = 0; i < resolved.distractors.length; i++) {
    const s = resolved.distractors[i];
    if (typeof s === 'string' && s.length > 0) distractorIdxs.push(i);
  }
  if (distractorIdxs.length < 3) return null;

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
    // `d.english` is authoritative — it comes from the RESOLVED arrays, which
    // for state-substituted questions (capital) are built from STATE_DATA and
    // have no localized counterpart. Only adopt the localized string when the
    // parallel entry describes the same English text; otherwise fall back to
    // English-only. All-or-nothing, never a mixed pair.
    if (!lookup || lookup.english !== d.english || lookup.localized === undefined) {
      return { english: d.english };
    }
    const out: DisplayText = { english: d.english, localized: lookup.localized };
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
