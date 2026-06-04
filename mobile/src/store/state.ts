// Quiz state machine — useReducer-based. No nav library, no persistence.
//
// `quizReducer` is exported as a pure function so the smoke runner can
// exercise transitions without a React tree.

import { useReducer } from 'react';
import type {
  LangCode,
  Question,
  RouteKey,
  USStateCode,
} from '../types/quiz.ts';

export type Screen = 'onboard' | 'quiz' | 'result';
export type Tab = 'practice' | 'resources';

export type AnswerLog = {
  questionId: number;
  kind: 'mcq' | 'studyCard' | 'unsupported';
  correct?: boolean;
};

export type LastResult = 'pending' | 'correct' | 'wrong' | 'acknowledged';

export type QuizState = {
  // Top-level tab — orthogonal to `screen`. Switching tabs preserves
  // in-progress quiz state so the user can pop back to where they left off.
  tab: Tab;
  screen: Screen;
  route: RouteKey;
  lang: LangCode;
  // Optional U.S. state for state-resolved MCQ questions (e.g. Q62 capital).
  // `undefined` means user has not picked a state — Q62 stays as a Study Card.
  userState?: USStateCode;
  sequence: Question[];
  index: number;
  // MCQ-only counters
  correct: number;
  wrong: number;
  answers: AnswerLog[];
  lastResult: LastResult;
};

export type QuizAction =
  | { type: 'set-tab'; tab: Tab }
  | { type: 'set-route'; route: RouteKey }
  | { type: 'set-lang'; lang: LangCode }
  | { type: 'set-state'; userState: USStateCode | undefined }
  | { type: 'start'; sequence: Question[] }
  | { type: 'answer-mcq'; correct: boolean; questionId: number }
  | { type: 'acknowledge-study-card'; questionId: number }
  | { type: 'log-unsupported'; questionId: number }
  | { type: 'next' }
  | { type: 'reset' };

export const initialState: QuizState = {
  tab: 'practice',
  screen: 'onboard',
  route: '2025',
  lang: 'en',
  userState: undefined,
  sequence: [],
  index: 0,
  correct: 0,
  wrong: 0,
  answers: [],
  lastResult: 'pending',
};

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'set-tab':
      return { ...state, tab: action.tab };
    case 'set-route':
      return { ...state, route: action.route };
    case 'set-lang':
      return { ...state, lang: action.lang };
    case 'set-state':
      return { ...state, userState: action.userState };
    case 'start':
      return {
        ...state,
        screen: 'quiz',
        sequence: action.sequence,
        index: 0,
        correct: 0,
        wrong: 0,
        answers: [],
        lastResult: 'pending',
      };
    case 'answer-mcq':
      return {
        ...state,
        correct: state.correct + (action.correct ? 1 : 0),
        wrong: state.wrong + (action.correct ? 0 : 1),
        answers: [
          ...state.answers,
          { questionId: action.questionId, kind: 'mcq', correct: action.correct },
        ],
        lastResult: action.correct ? 'correct' : 'wrong',
      };
    case 'acknowledge-study-card':
      return {
        ...state,
        answers: [
          ...state.answers,
          { questionId: action.questionId, kind: 'studyCard' },
        ],
        lastResult: 'acknowledged',
      };
    case 'log-unsupported':
      return {
        ...state,
        answers: [
          ...state.answers,
          { questionId: action.questionId, kind: 'unsupported' },
        ],
        lastResult: 'acknowledged',
      };
    case 'next': {
      const nextIndex = state.index + 1;
      if (nextIndex >= state.sequence.length) {
        return { ...state, screen: 'result' };
      }
      return { ...state, index: nextIndex, lastResult: 'pending' };
    }
    case 'reset':
      // Keep last tab/route/lang/state choices so the user can try again quickly.
      return {
        ...initialState,
        tab: state.tab,
        route: state.route,
        lang: state.lang,
        userState: state.userState,
      };
  }
}

export function useQuizState() {
  return useReducer(quizReducer, initialState);
}
