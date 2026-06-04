// Static data loader. Pulls `mobile/data.json` synced from repo root by
// `npm run sync-data`. Phase 3A is in-memory only — no fetch, no cache,
// no AsyncStorage.
//
// The actual per-route filter lives in `quiz/pick.ts` as
// `getQuestionBankFromData(routeKey, appData)` — a pure function. This
// loader is a thin wrapper that pins it to the bundled JSON.

import rawData from '../../data.json';
import { getQuestionBankFromData } from '../quiz/pick.ts';
import type {
  AppData,
  LangMeta,
  Question,
  RouteConfigMap,
  RouteKey,
} from '../types/quiz';

const data = rawData as unknown as AppData;

export function loadAppData(): AppData {
  return data;
}

export function getQuestionBank(routeKey: RouteKey): Question[] {
  return getQuestionBankFromData(routeKey, data);
}

export function getLanguages(): LangMeta {
  return data.langMeta;
}

export function getRouteConfig(): RouteConfigMap {
  return data.routeConfig;
}
