import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { buildQuizViewModel } from '../store/buildViewModel.ts';
import type { LastResult } from '../store/state.ts';
import { gradeAnswer } from '../quiz/grade.ts';
import { resolveQuestion } from '../quiz/resolve.ts';
import type { DisplayText, LangCode, Question } from '../types/quiz.ts';

type Props = {
  question: Question;
  index: number;
  total: number;
  correct: number;
  wrong: number;
  lang: LangCode;
  lastResult: LastResult;
  onAnswerMcq: (correct: boolean, questionId: number) => void;
  onAcknowledgeStudyCard: (questionId: number) => void;
  onLogUnsupported: (questionId: number) => void;
  onNext: () => void;
};

export function QuizScreen({
  question,
  index,
  total,
  correct,
  wrong,
  lang,
  lastResult,
  onAnswerMcq,
  onAcknowledgeStudyCard,
  onLogUnsupported,
  onNext,
}: Props) {
  const resolved = useMemo(() => resolveQuestion(question), [question]);
  const viewModel = useMemo(() => {
    if (resolved.kind !== 'mcq') return null;
    return buildQuizViewModel(resolved, { lang });
  }, [resolved, lang]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.progress}>
          Question {index + 1} of {total}
        </Text>
        <Text style={styles.score}>
          {correct} / {wrong}
        </Text>
      </View>

      <Prompt prompt={viewModel?.prompt ?? { english: question.q }} />

      {resolved.kind === 'mcq' && viewModel !== null && (
        <McqOptions
          viewModel={viewModel}
          question={question}
          lastResult={lastResult}
          onAnswerMcq={onAnswerMcq}
          onNext={onNext}
        />
      )}

      {resolved.kind === 'mcq' && viewModel === null && (
        <ErrorCard
          message={`Could not build a 4-option question (missing accepted or distractors). Skipping safely.`}
          questionId={question.id}
          onAcknowledge={() => onLogUnsupported(question.id)}
          onNext={onNext}
        />
      )}

      {resolved.kind === 'needsInfoCard' && (
        <StudyCard
          headline="Study Card"
          body={dynamicOfficeholderCopy(resolved.reason)}
          link="https://www.uscis.gov/citizenship/testupdates"
          lastResult={lastResult}
          onAcknowledge={() => onAcknowledgeStudyCard(question.id)}
          onNext={onNext}
        />
      )}

      {resolved.kind === 'needsState' && (
        <StudyCard
          headline="Study Card · State-specific"
          body={
            'This question depends on which U.S. state you live in. We do not collect your state in this practice build, so this card is for review only. It is not counted in your score.\n\nDuring the real interview, the USCIS officer will accept the answer for your state of residence.'
          }
          lastResult={lastResult}
          onAcknowledge={() => onAcknowledgeStudyCard(question.id)}
          onNext={onNext}
        />
      )}

      {resolved.kind === 'unsupportedInPhase3A' && (
        <ErrorCard
          message={`Unsupported question in this build (${resolved.reason}). It is not counted in your score.`}
          questionId={question.id}
          onAcknowledge={() => onLogUnsupported(question.id)}
          onNext={onNext}
        />
      )}
    </ScrollView>
  );
}

function dynamicOfficeholderCopy(
  reason: 'dynamic-officeholder' | 'state-senators' | 'state-governor',
): string {
  switch (reason) {
    case 'dynamic-officeholder':
      return (
        'This question is about a current federal officeholder. ' +
        'The answer changes after every election or appointment, so ' +
        'this app does not show a name. Look up the current official ' +
        'at uscis.gov/citizenship/testupdates before your interview. ' +
        'This card is for review only and is not counted in your score.'
      );
    case 'state-senators':
      return (
        'This question is about your U.S. senators, which depend on ' +
        'your state of residence. This card is for review only and is ' +
        'not counted in your score. The USCIS officer will accept ' +
        'either of the two senators for your state.'
      );
    case 'state-governor':
      return (
        'This question is about your state governor, which depends on ' +
        'your state of residence. This card is for review only and is ' +
        'not counted in your score.'
      );
  }
}

type McqOptionsProps = {
  viewModel: NonNullable<ReturnType<typeof buildQuizViewModel>>;
  question: Question;
  lastResult: LastResult;
  onAnswerMcq: (correct: boolean, questionId: number) => void;
  onNext: () => void;
};

function McqOptions({
  viewModel,
  question,
  lastResult,
  onAnswerMcq,
  onNext,
}: McqOptionsProps) {
  const answered = lastResult === 'correct' || lastResult === 'wrong';
  return (
    <View style={styles.options}>
      {viewModel.options.map((opt, i) => {
        const isCorrectChoice = i === viewModel.correctIndex;
        const showAsCorrect = answered && isCorrectChoice;
        return (
          <Pressable
            key={i}
            disabled={answered}
            onPress={() => {
              // Grade ALWAYS uses the English option value (web parity).
              const isCorrect = gradeAnswer(opt.english, question);
              onAnswerMcq(isCorrect, question.id);
            }}
            style={[styles.option, showAsCorrect && styles.optionCorrect]}
          >
            <OptionText opt={opt} onDark={showAsCorrect} />
          </Pressable>
        );
      })}

      {answered && (
        <View style={styles.feedbackRow}>
          <Text
            style={
              lastResult === 'correct'
                ? styles.feedbackCorrect
                : styles.feedbackWrong
            }
          >
            {lastResult === 'correct' ? 'Correct.' : 'Not quite.'}
          </Text>
          <Pressable onPress={onNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Prompt({ prompt }: { prompt: DisplayText }) {
  if (prompt.localized !== undefined) {
    return (
      <View style={styles.promptBlock}>
        <Text style={styles.promptLocalized}>{prompt.localized}</Text>
        <Text style={styles.promptEnglish}>{prompt.english}</Text>
        {prompt.suggested === true && (
          <Text style={styles.suggestedBadge}>Suggested translation</Text>
        )}
      </View>
    );
  }
  return (
    <View style={styles.promptBlock}>
      <Text style={styles.prompt}>{prompt.english}</Text>
    </View>
  );
}

function OptionText({
  opt,
  onDark,
}: {
  opt: DisplayText;
  onDark: boolean;
}) {
  if (opt.localized !== undefined) {
    return (
      <View>
        <Text style={[styles.optionLocalized, onDark && styles.optionTextOnDark]}>
          {opt.localized}
        </Text>
        <Text style={[styles.optionEnglish, onDark && styles.optionSubtextOnDark]}>
          {opt.english}
        </Text>
        {opt.suggested === true && (
          <Text style={[styles.optionSuggested, onDark && styles.optionSubtextOnDark]}>
            Suggested translation
          </Text>
        )}
      </View>
    );
  }
  return (
    <Text style={[styles.optionText, onDark && styles.optionTextOnDark]}>
      {opt.english}
    </Text>
  );
}

type StudyCardProps = {
  headline: string;
  body: string;
  link?: string;
  lastResult: LastResult;
  onAcknowledge: () => void;
  onNext: () => void;
};

function StudyCard({
  headline,
  body,
  link,
  lastResult,
  onAcknowledge,
  onNext,
}: StudyCardProps) {
  const acknowledged = lastResult === 'acknowledged';
  return (
    <View style={styles.studyCard}>
      <Text style={styles.studyHeadline}>{headline}</Text>
      <Text style={styles.studyBody}>{body}</Text>
      {link && <Text style={styles.studyLink}>{link}</Text>}
      <Pressable
        disabled={acknowledged}
        onPress={() => {
          onAcknowledge();
          onNext();
        }}
        style={styles.nextBtn}
      >
        <Text style={styles.nextBtnText}>Next</Text>
      </Pressable>
    </View>
  );
}

type ErrorCardProps = {
  message: string;
  questionId: number;
  onAcknowledge: () => void;
  onNext: () => void;
};

function ErrorCard({
  message,
  questionId,
  onAcknowledge,
  onNext,
}: ErrorCardProps) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorHeadline}>Cannot Grade — Question #{questionId}</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Pressable
        onPress={() => {
          onAcknowledge();
          onNext();
        }}
        style={styles.nextBtn}
      >
        <Text style={styles.nextBtnText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progress: {
    fontSize: 13,
    color: '#666',
  },
  score: {
    fontSize: 13,
    color: '#0b2447',
    fontWeight: '600',
  },
  promptBlock: {
    marginBottom: 16,
  },
  prompt: {
    fontSize: 18,
    color: '#0b2447',
    lineHeight: 26,
  },
  promptLocalized: {
    fontSize: 18,
    color: '#0b2447',
    lineHeight: 26,
  },
  promptEnglish: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginTop: 4,
  },
  suggestedBadge: {
    fontSize: 11,
    color: '#7a6300',
    fontStyle: 'italic',
    marginTop: 4,
  },
  options: {
    gap: 10,
  },
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  optionCorrect: {
    backgroundColor: '#1f6b3a',
    borderColor: '#1f6b3a',
  },
  optionText: {
    fontSize: 15,
    color: '#222',
  },
  optionLocalized: {
    fontSize: 15,
    color: '#222',
  },
  optionEnglish: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  optionSuggested: {
    fontSize: 11,
    color: '#7a6300',
    fontStyle: 'italic',
    marginTop: 2,
  },
  optionTextOnDark: {
    color: '#fff',
    fontWeight: '600',
  },
  optionSubtextOnDark: {
    color: 'rgba(255,255,255,0.85)',
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  feedbackCorrect: {
    color: '#1f6b3a',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackWrong: {
    color: '#a31621',
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#0b2447',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  studyCard: {
    borderWidth: 1,
    borderColor: '#d0c898',
    backgroundColor: '#fffaea',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  studyHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7a6300',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  studyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#222',
  },
  studyLink: {
    fontSize: 13,
    color: '#0b2447',
    fontWeight: '500',
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#a31621',
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  errorHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a31621',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#222',
  },
});
