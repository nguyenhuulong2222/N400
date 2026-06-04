// Static study-material directory. Every external link uses
// Linking.openURL to open in the system browser — NO WebView import,
// NO in-app rendering of USCIS pages (Invariant VI / VII / VIII).
//
// English UI only. All link targets are on `uscis.gov` subdomains.

import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type LinkItem = {
  title: string;
  url: string;
  detail?: string;
};

const OFFICIAL_MATERIALS: LinkItem[] = [
  {
    title: 'USCIS Citizenship Resource Center',
    url: 'https://www.uscis.gov/citizenship',
    detail: 'Hub for naturalization study materials and exam prep.',
  },
  {
    title: 'Study for the civics test',
    url: 'https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test',
    detail: 'Current 2025 civics test materials.',
  },
  {
    title: '2008 civics test (pre-Oct 2025 applicants)',
    url: 'https://www.uscis.gov/citizenship/2008-civics-test',
    detail: 'For Form N-400 filed before October 20, 2025.',
  },
  {
    title: 'Form N-400 instructions',
    url: 'https://www.uscis.gov/n-400',
    detail: 'Application for Naturalization — official page and PDFs.',
  },
  {
    title: 'Test updates and current officials',
    url: 'https://www.uscis.gov/citizenship/testupdates',
    detail:
      'Check this before your interview — answers for President, VP, Speaker, Chief Justice, and your state senators change over time.',
  },
];

const BEFORE_YOUR_INTERVIEW: string[] = [
  'Bring your interview appointment notice (Form I-797C).',
  'Bring your Permanent Resident Card (green card) and a government-issued photo ID.',
  'Review the answers you provided on your Form N-400 — the officer will ask about them.',
  'Practice speaking your answers out loud, including your name and address.',
  'Check current federal officials and your state senators before the day — these change over time.',
];

const USEFUL_LINKS: LinkItem[] = [
  {
    title: 'USCIS online account (my.uscis.gov)',
    url: 'https://my.uscis.gov',
    detail: 'Track your case, upload documents, and message USCIS.',
  },
  {
    title: 'Find a USCIS office',
    url: 'https://www.uscis.gov/about-us/find-a-uscis-office',
    detail: 'Field office locator.',
  },
  {
    title: 'Check case status',
    url: 'https://egov.uscis.gov/casestatus/landing.do',
    detail: 'Look up your receipt number.',
  },
  {
    title: 'Change of address',
    url: 'https://www.uscis.gov/addresschange',
    detail: 'Form AR-11 — update your address while a case is pending.',
  },
  {
    title: 'Processing times',
    url: 'https://egov.uscis.gov/processing-times/',
    detail: 'Current estimated processing times by form and field office.',
  },
];

async function openLink(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Could not open link', url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', url);
  }
}

export function ResourcesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Resources</Text>

      <Text style={styles.disclaimer}>
        Links open official USCIS pages in your browser. This app is an
        independent study tool and is not affiliated with USCIS.
      </Text>

      <SectionHeader>A. Official USCIS study materials</SectionHeader>
      <View style={styles.list}>
        {OFFICIAL_MATERIALS.map((item) => (
          <LinkRow key={item.url} item={item} />
        ))}
      </View>

      <SectionHeader>B. Before your interview</SectionHeader>
      <View style={styles.list}>
        {BEFORE_YOUR_INTERVIEW.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <SectionHeader>C. Useful links</SectionHeader>
      <View style={styles.list}>
        {USEFUL_LINKS.map((item) => (
          <LinkRow key={item.url} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function LinkRow({ item }: { item: LinkItem }) {
  return (
    <Pressable
      onPress={() => {
        void openLink(item.url);
      }}
      style={styles.linkRow}
    >
      <Text style={styles.linkTitle}>{item.title}</Text>
      {item.detail !== undefined && (
        <Text style={styles.linkDetail}>{item.detail}</Text>
      )}
      <Text style={styles.linkUrl}>{item.url}</Text>
    </Pressable>
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
    marginTop: 8,
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 10,
  },
  list: {
    gap: 10,
  },
  linkRow: {
    borderWidth: 1,
    borderColor: '#dde2ea',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafbfd',
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0b2447',
  },
  linkDetail: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
    lineHeight: 18,
  },
  linkUrl: {
    fontSize: 11,
    color: '#0b2447',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  bullet: {
    fontSize: 18,
    color: '#0b2447',
    width: 14,
  },
  tipText: {
    fontSize: 14,
    color: '#222',
    lineHeight: 20,
    flex: 1,
  },
});
