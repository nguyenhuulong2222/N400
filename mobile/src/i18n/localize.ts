// Pure localization helpers. Reads per-language fields from a Question
// object — never invents text, never auto-translates.
//
// Field-naming reference (from data.json, verified):
//   q.q                            English prompt
//   q.<lang>                       Localized prompt        (e.g. q.vi, q.es)
//   q.a                            English accepted        (string[])
//   q.<lang>_a                     Localized accepted      (string[])
//   q.distractors                  English distractors     (string[])
//   q['distractors_' + lang]       Localized distractors   (string[])
//   q.<lang>_suggested             true → localized prompt + accepted are
//                                  suggested (non-USCIS-official) translations
//   q['distractors_<lang>_suggested']  true → localized distractors are suggested
//
// Localized strings align by index with the English arrays. Missing fields
// (undefined, empty string, sparse-array hole) fall back to English with
// no localized side. This is intentional: do not invent translations.

import type { LangCode, Question } from '../types/quiz.ts';

export type LocalizedText = {
  english: string;
  // Present only when lang !== 'en' AND a non-empty localized string exists.
  localized?: string;
  // True when the localized translation is suggested (not USCIS-official).
  suggested?: boolean;
};

export type LocalizedQuestionView = {
  id: number;
  prompt: LocalizedText;
  accepted: LocalizedText[];
  distractors: LocalizedText[];
};

function readUnknownField(q: Question, key: string): unknown {
  return (q as unknown as Record<string, unknown>)[key];
}

function readStringField(q: Question, key: string): string | undefined {
  const v = readUnknownField(q, key);
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readBoolField(q: Question, key: string): boolean {
  return readUnknownField(q, key) === true;
}

export function getPrompt(q: Question, lang: LangCode): LocalizedText {
  const english = typeof q.q === 'string' ? q.q : '';
  if (lang === 'en') return { english };
  const localized = readStringField(q, lang);
  if (localized === undefined) return { english };
  const suggested = readBoolField(q, `${lang}_suggested`);
  const out: LocalizedText = { english, localized };
  if (suggested) out.suggested = true;
  return out;
}

function buildLocalizedArray(
  englishArr: string[] | undefined,
  localizedArr: unknown,
  suggested: boolean,
): LocalizedText[] {
  const en = Array.isArray(englishArr) ? englishArr : [];
  return en.map((english, i) => {
    if (!Array.isArray(localizedArr)) return { english };
    const raw = (localizedArr as unknown[])[i];
    if (typeof raw !== 'string' || raw.length === 0) return { english };
    const out: LocalizedText = { english, localized: raw };
    if (suggested) out.suggested = true;
    return out;
  });
}

export function getAccepted(q: Question, lang: LangCode): LocalizedText[] {
  const en = Array.isArray(q.a) ? q.a : [];
  if (lang === 'en') return en.map((english) => ({ english }));
  const localizedArr = readUnknownField(q, `${lang}_a`);
  const suggested = readBoolField(q, `${lang}_suggested`);
  return buildLocalizedArray(en, localizedArr, suggested);
}

export function getDistractors(q: Question, lang: LangCode): LocalizedText[] {
  const en = Array.isArray(q.distractors) ? q.distractors : [];
  if (lang === 'en') return en.map((english) => ({ english }));
  const localizedArr = readUnknownField(q, `distractors_${lang}`);
  const suggested = readBoolField(q, `distractors_${lang}_suggested`);
  return buildLocalizedArray(en, localizedArr, suggested);
}

export function getLocalizedQuestionView(
  q: Question,
  lang: LangCode,
): LocalizedQuestionView {
  return {
    id: q.id,
    prompt: getPrompt(q, lang),
    accepted: getAccepted(q, lang),
    distractors: getDistractors(q, lang),
  };
}
