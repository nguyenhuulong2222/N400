import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getRouteConfig } from '../data/load.ts';
import type { AnswerLog } from '../store/state.ts';
import type { RouteKey } from '../types/quiz.ts';

type Props = {
  route: RouteKey;
  correct: number;
  wrong: number;
  answers: AnswerLog[];
  onTryAgain: () => void;
};

export function ResultScreen({
  route,
  correct,
  wrong,
  answers,
  onTryAgain,
}: Props) {
  const cfg = getRouteConfig()[route];
  const mcqAnswered = answers.filter((a) => a.kind === 'mcq').length;
  const studyCards = answers.filter((a) => a.kind === 'studyCard').length;
  const unsupported = answers.filter((a) => a.kind === 'unsupported').length;
  const totalSeen = answers.length;

  let verdict: 'pass' | 'fail' | 'incomplete';
  if (correct >= cfg.passThreshold) verdict = 'pass';
  else if (wrong >= cfg.failThreshold) verdict = 'fail';
  else verdict = 'incomplete';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text
        style={[
          styles.verdict,
          verdict === 'pass'
            ? styles.verdictPass
            : verdict === 'fail'
              ? styles.verdictFail
              : styles.verdictIncomplete,
        ]}
      >
        {verdict === 'pass'
          ? 'Pass'
          : verdict === 'fail'
            ? 'Did not pass'
            : 'Incomplete'}
      </Text>

      <Text style={styles.routeLabel}>{cfg.label ?? route}</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreNum}>
          {correct} / {cfg.askCount}
        </Text>
        <Text style={styles.scoreLabel}>MCQ correct out of asked</Text>
        <Text style={styles.scoreDetail}>
          Need {cfg.passThreshold} to pass · {cfg.failThreshold} wrong to fail
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="MCQ answered" value={mcqAnswered} />
        <Stat label="Correct" value={correct} />
        <Stat label="Wrong" value={wrong} />
      </View>

      <Text style={styles.cardCountLine}>
        {totalSeen} cards seen including {studyCards} study card
        {studyCards === 1 ? '' : 's'}
        {unsupported > 0 ? ` · ${unsupported} unsupported` : ''}
      </Text>

      <Pressable onPress={onTryAgain} style={styles.tryAgainBtn}>
        <Text style={styles.tryAgainBtnText}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  verdict: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  verdictPass: {
    color: '#1f6b3a',
  },
  verdictFail: {
    color: '#a31621',
  },
  verdictIncomplete: {
    color: '#7a6300',
  },
  routeLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scoreCard: {
    backgroundColor: '#eef2f9',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  scoreNum: {
    fontSize: 38,
    fontWeight: '700',
    color: '#0b2447',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#444',
  },
  scoreDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0b2447',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  cardCountLine: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
  tryAgainBtn: {
    backgroundColor: '#0b2447',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  tryAgainBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
