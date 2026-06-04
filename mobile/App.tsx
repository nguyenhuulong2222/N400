import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { loadAppData } from './src/data/load.ts';
import { pickQuestions } from './src/quiz/pick.ts';

const data = loadAppData();
const sample2025 = pickQuestions('2025', data).length;
const sample2008 = pickQuestions('2008', data).length;
const langCount = Object.keys(data.langMeta).length;

const lines = [
  `Form N-400 data loaded: ${data.questions2025.length} / ${data.questions2008.length} / ${langCount}`,
  'Quiz engine loaded',
  `2025 route sample: ${sample2025} questions`,
  `2008 route sample: ${sample2008} questions`,
];

export default function App() {
  return (
    <View style={styles.container}>
      {lines.map((line, i) => (
        <Text key={i} style={styles.text}>
          {line}
        </Text>
      ))}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    color: '#0b2447',
    textAlign: 'center',
    marginVertical: 4,
  },
});
