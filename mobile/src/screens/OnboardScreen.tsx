import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getLanguages, getRouteConfig } from '../data/load.ts';
import type {
  LangCode,
  LangMetaEntry,
  RouteConfig,
  RouteKey,
} from '../types/quiz.ts';

type Props = {
  selectedRoute: RouteKey;
  selectedLang: LangCode;
  onSelectRoute: (route: RouteKey) => void;
  onSelectLang: (lang: LangCode) => void;
  onStart: () => void;
};

export function OnboardScreen({
  selectedRoute,
  selectedLang,
  onSelectRoute,
  onSelectLang,
  onStart,
}: Props) {
  const routes = Object.entries(getRouteConfig()) as [RouteKey, RouteConfig][];
  const langs = Object.entries(getLanguages()) as [LangCode, LangMetaEntry][];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Form N-400 Practice</Text>

      <Text style={styles.sectionLabel}>Route</Text>
      <View style={styles.column}>
        {routes.map(([key, cfg]) => {
          const isSelected = selectedRoute === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelectRoute(key)}
              style={[styles.routeBtn, isSelected && styles.routeBtnSelected]}
            >
              <Text
                style={[
                  styles.routeBtnTitle,
                  isSelected && styles.routeBtnTitleSelected,
                ]}
              >
                {cfg.label ?? key}
              </Text>
              <Text style={styles.routeBtnSubtext}>
                {cfg.askCount} questions · {cfg.passThreshold} to pass
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Language</Text>
      <View style={styles.langGrid}>
        {langs.map(([code, meta]) => {
          const isSelected = selectedLang === code;
          return (
            <Pressable
              key={code}
              onPress={() => onSelectLang(code)}
              style={[styles.langBtn, isSelected && styles.langBtnSelected]}
            >
              <Text
                style={[
                  styles.langBtnText,
                  isSelected && styles.langBtnTextSelected,
                ]}
              >
                {meta.flag ? `${meta.flag} ` : ''}
                {meta.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        UI is English-only in this preview build. Quiz prompts and choices
        are also shown in English.
      </Text>

      <Pressable onPress={onStart} style={styles.startBtn}>
        <Text style={styles.startBtnText}>Start Practice</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0b2447',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  column: {
    gap: 8,
  },
  routeBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  routeBtnSelected: {
    borderColor: '#0b2447',
    backgroundColor: '#eef2f9',
  },
  routeBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0b2447',
  },
  routeBtnTitleSelected: {
    color: '#0b2447',
  },
  routeBtnSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  langBtnSelected: {
    borderColor: '#0b2447',
    backgroundColor: '#0b2447',
  },
  langBtnText: {
    fontSize: 13,
    color: '#222',
  },
  langBtnTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: '#a31621',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 18,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
