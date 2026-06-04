// Typed shapes for the exported `data.json` payload and the runtime quiz engine.
//
// The data shape mirrors `tools/build-app-data.js` output. `Question` carries
// optional metadata flags from the web data (dynamic officeholder, state-
// resolved fields, excluded marker, starred_6520 subset) plus an index
// signature for the per-language fields (`vi_a`, `es_a`, `vi_distractors`,
// `vi_suggested`, …). Localized fields are not used in Phase 3A.

export type LangCode =
  | 'en' | 'vi' | 'es' | 'zh' | 'tl' | 'ko'
  | 'hi' | 'ht' | 'th' | 'lo' | 'hmn' | 'my' | 'pt' | 'ru';

export type RouteKey =
  | '2025'
  | '2008'
  | '6520_2025'
  | '6520_2008'
  | '5020'
  | '5515';

export type OfficialField = 'president' | 'vp' | 'speaker' | 'chiefJustice';
export type StateField = 'senators' | 'governor' | 'capital';

export type Question = {
  id: number;
  q: string;
  a?: string[];
  distractors?: string[];
  starred_6520?: boolean;
  dynamic?: boolean;
  officialField?: OfficialField;
  dynamic_note?: string;
  stateField?: StateField;
  helpNote?: string;
  excluded?: boolean;
  // Per-language fields keyed dynamically (vi_a, es_a, vi_distractors, …).
  readonly [extra: string]: unknown;
};

export type RouteConfig = {
  askCount: number;
  passThreshold: number;
  failThreshold: number;
  label?: string;
};

export type RouteConfigMap = Record<RouteKey, RouteConfig>;

export type LangMetaEntry = {
  name: string;
  tts?: string;
  flag?: string;
  dir?: 'ltr' | 'rtl';
};

export type LangMeta = Record<LangCode, LangMetaEntry>;

export type StateData = Record<string, Record<string, string | string[]>>;

export type AppData = {
  schemaVersion: number;
  contentVersion: string;
  generatedAt: string;
  source?: Record<string, unknown>;
  questions2025: Question[];
  questions2008: Question[];
  langMeta: LangMeta;
  uiText: Record<string, string>;
  stateData: StateData;
  routeConfig: RouteConfigMap;
  integrity: {
    question2025Count: number;
    question2008Count: number;
    languageCount: number;
  };
};

// Tagged-union return type for resolveQuestion. Phase 3A returns explicit
// status codes for questions that need UI Phase 3B has not built yet.
export type ResolvedQuestion =
  | {
      kind: 'mcq';
      question: Question;
      accepted: string[];
      distractors: string[];
    }
  | {
      kind: 'needsInfoCard';
      question: Question;
      reason: 'dynamic-officeholder' | 'state-senators' | 'state-governor';
    }
  | {
      kind: 'needsState';
      question: Question;
      stateField: StateField;
    }
  | {
      kind: 'unsupportedInPhase3A';
      question: Question;
      reason: string;
    };

// Smoke-test view model — exact shape a future UI would consume per question.
export type QuizQuestionViewModel = {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  acceptedAnswers: string[];
};

export type Rng = () => number;
