import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { loadAppData } from './src/data/load.ts';
import { pickQuestions } from './src/quiz/pick.ts';
import { useQuizState } from './src/store/state.ts';
import { OnboardScreen } from './src/screens/OnboardScreen.tsx';
import { QuizScreen } from './src/screens/QuizScreen.tsx';
import { ResultScreen } from './src/screens/ResultScreen.tsx';

const data = loadAppData();

export default function App() {
  const [state, dispatch] = useQuizState();
  const currentQuestion =
    state.screen === 'quiz' ? state.sequence[state.index] : undefined;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
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
      </View>
      <Text style={styles.disclaimer}>
        Not affiliated with USCIS. Educational use only.
      </Text>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
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
