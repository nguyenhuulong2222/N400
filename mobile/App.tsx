import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { loadAppData } from './src/data/load.ts';
import { pickQuestions } from './src/quiz/pick.ts';
import { useQuizState } from './src/store/state.ts';
import type { Tab } from './src/store/state.ts';
import { OnboardScreen } from './src/screens/OnboardScreen.tsx';
import { QuizScreen } from './src/screens/QuizScreen.tsx';
import { ResultScreen } from './src/screens/ResultScreen.tsx';
import { ResourcesScreen } from './src/screens/ResourcesScreen.tsx';

const data = loadAppData();

export default function App() {
  const [state, dispatch] = useQuizState();
  const currentQuestion =
    state.screen === 'quiz' ? state.sequence[state.index] : undefined;

  return (
    <SafeAreaView style={styles.root}>
      <TabBar
        tab={state.tab}
        onSetTab={(tab) => dispatch({ type: 'set-tab', tab })}
      />
      <View style={styles.body}>
        {state.tab === 'practice' && (
          <>
            {state.screen === 'onboard' && (
              <OnboardScreen
                selectedRoute={state.route}
                selectedLang={state.lang}
                selectedState={state.userState}
                onSelectRoute={(route) => dispatch({ type: 'set-route', route })}
                onSelectLang={(lang) => dispatch({ type: 'set-lang', lang })}
                onSelectState={(userState) =>
                  dispatch({ type: 'set-state', userState })
                }
                onStart={() => {
                  const sequence = pickQuestions(state.route, data);
                  dispatch({ type: 'start', sequence });
                }}
              />
            )}
            {state.screen === 'quiz' && currentQuestion && (
              <QuizScreen
                question={currentQuestion}
                index={state.index}
                total={state.sequence.length}
                correct={state.correct}
                wrong={state.wrong}
                lang={state.lang}
                userState={state.userState}
                lastResult={state.lastResult}
                onAnswerMcq={(correct, questionId) =>
                  dispatch({ type: 'answer-mcq', correct, questionId })
                }
                onAcknowledgeStudyCard={(questionId) =>
                  dispatch({ type: 'acknowledge-study-card', questionId })
                }
                onLogUnsupported={(questionId) =>
                  dispatch({ type: 'log-unsupported', questionId })
                }
                onNext={() => dispatch({ type: 'next' })}
              />
            )}
            {state.screen === 'result' && (
              <ResultScreen
                route={state.route}
                correct={state.correct}
                wrong={state.wrong}
                answers={state.answers}
                onTryAgain={() => dispatch({ type: 'reset' })}
              />
            )}
          </>
        )}
        {state.tab === 'resources' && <ResourcesScreen />}
      </View>
      <Text style={styles.disclaimer}>
        Not affiliated with USCIS. Educational use only.
      </Text>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function TabBar({ tab, onSetTab }: { tab: Tab; onSetTab: (t: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TabButton label="Practice" active={tab === 'practice'} onPress={() => onSetTab('practice')} />
      <TabButton label="Resources" active={tab === 'resources'} onPress={() => onSetTab('resources')} />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f6f7f9',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#0b2447',
    backgroundColor: '#fff',
  },
  tabBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabBtnTextActive: {
    color: '#0b2447',
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  disclaimer: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
});
