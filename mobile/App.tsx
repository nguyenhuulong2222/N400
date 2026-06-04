import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import rawData from './data.json';

type AppData = {
  questions2025: unknown[];
  questions2008: unknown[];
  langMeta: Record<string, unknown>;
};

const data = rawData as unknown as AppData;

const summary = `Form N-400 data loaded: ${data.questions2025.length} / ${data.questions2008.length} / ${Object.keys(data.langMeta).length}`;

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{summary}</Text>
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
    fontSize: 18,
    color: '#0b2447',
    textAlign: 'center',
  },
});
