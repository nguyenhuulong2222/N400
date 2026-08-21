import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { loadAppData, getLanguages, getRouteConfig } from '../data/load.ts';
import type {
  LangCode,
  LangMetaEntry,
  RouteConfig,
  RouteKey,
  StateDataEntry,
  USStateCode,
} from '../types/quiz.ts';

type Props = {
  selectedRoute: RouteKey;
  selectedLang: LangCode;
  selectedState: USStateCode | undefined;
  onSelectRoute: (route: RouteKey) => void;
  onSelectLang: (lang: LangCode) => void;
  onSelectState: (state: USStateCode | undefined) => void;
  onStart: () => void;
};

export function OnboardScreen({
  selectedRoute,
  selectedLang,
  selectedState,
  onSelectRoute,
  onSelectLang,
  onSelectState,
  onStart,
}: Props) {
  // Explicit display order — data.json's routeConfig key order puts 2008
  // first, but 2025 is the current test and belongs at the top. Any route
  // present in data but missing from this list is appended, so adding a
  // route to the data never silently hides it.
  const ROUTE_ORDER: RouteKey[] = [
    '2025',
    '2008',
    '6520_2025',
    '6520_2008',
    '5020',
    '5515',
  ];
  const routeEntries = Object.entries(getRouteConfig()) as [RouteKey, RouteConfig][];
  const routes = [
    ...ROUTE_ORDER.flatMap((key) => {
      const hit = routeEntries.find(([k]) => k === key);
      return hit ? [hit] : [];
    }),
    ...routeEntries.filter(([k]) => !ROUTE_ORDER.includes(k)),
  ];
  const langs = Object.entries(getLanguages()) as [LangCode, LangMetaEntry][];
  // Source the state list directly from data — never hardcode it.
  const states = (
    Object.entries(loadAppData().stateData) as [USStateCode, StateDataEntry][]
  ).sort(([, a], [, b]) => {
    const an = typeof a.name === 'string' ? a.name : '';
    const bn = typeof b.name === 'string' ? b.name : '';
    return an.localeCompare(bn);
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>N-400 Citizenship Test</Text>

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

      <Text style={styles.sectionLabel}>Your state (optional)</Text>
      <Text style={styles.helper}>
        Used only for state-specific questions like "What is the capital of
        your state?". Skip to keep those questions as study cards.
      </Text>
      <View style={styles.stateGrid}>
        <Pressable
          onPress={() => onSelectState(undefined)}
          style={[
            styles.stateBtn,
            selectedState === undefined && styles.stateBtnSelected,
          ]}
        >
          <Text
            style={[
              styles.stateBtnText,
              selectedState === undefined && styles.stateBtnTextSelected,
            ]}
          >
            Skip
          </Text>
        </Pressable>
        {states.map(([code, entry]) => {
          const isSelected = selectedState === code;
          return (
            <Pressable
              key={code}
              onPress={() => onSelectState(code)}
              style={[styles.stateBtn, isSelected && styles.stateBtnSelected]}
            >
              <Text
                style={[
                  styles.stateBtnText,
                  isSelected && styles.stateBtnTextSelected,
                ]}
              >
                {typeof entry.name === 'string' ? entry.name : code}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Menus and buttons are in English. Question prompts and answer choices
        appear in your selected language with the English text below them.
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
    color: '#0d2052',
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
    borderColor: '#0d2052',
    backgroundColor: '#eef2f9',
  },
  routeBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d2052',
  },
  routeBtnTitleSelected: {
    color: '#0d2052',
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
    borderColor: '#0d2052',
    backgroundColor: '#0d2052',
  },
  langBtnText: {
    fontSize: 13,
    color: '#222',
  },
  helper: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    marginTop: -6,
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stateBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  stateBtnSelected: {
    borderColor: '#0d2052',
    backgroundColor: '#0d2052',
  },
  stateBtnText: {
    fontSize: 12,
    color: '#222',
  },
  stateBtnTextSelected: {
    color: '#fff',
    fontWeight: '600',
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
