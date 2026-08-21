// Text-to-speech via expo-speech.
//
// expo-speech needs no permission string and no config plugin (SDK 56 docs,
// "Speech"). It speaks with whatever voices the OS has installed, which
// varies per device and per user — so we probe at startup rather than
// assuming, and we never fail silently.
//
// The rule: if the device has a voice for the selected language, we speak
// the LOCALIZED text in that language. If it does not, we speak the ENGLISH
// text with an English voice and the UI shows an "Audio in English" note.
// We never hand localized text to a mismatched voice — a Vietnamese string
// read by an en-US voice is unintelligible, which is worse than English.
//
// `hmn` (Hmong) is English-audio by construction: no platform ships a Hmong
// voice, which is why langMeta already declares `tts: "en-US"` for it. It is
// labelled exactly like any other missing-voice language.

import * as Speech from 'expo-speech';
import type { LangCode, LangMeta } from '../types/quiz.ts';

export type VoiceStatus = {
  // True when the device can speak this language in its own voice.
  hasNativeVoice: boolean;
  // BCP-47 tag passed to Speech.speak.
  spokenLanguage: string;
  // Specific voice identifier when we matched one; undefined lets the OS pick.
  voiceIdentifier?: string;
  // The tts tag langMeta requested, for diagnostics.
  requested: string;
};

export type VoiceMap = Record<string, VoiceStatus>;

const ENGLISH_FALLBACK = 'en-US';

// "vi-VN" -> "vi";  "cmn-Hans-CN" -> "cmn"
function primarySubtag(tag: string): string {
  return tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
}

/**
 * Probe the device's installed voices and decide, per language, whether we
 * can speak natively or must fall back to English.
 *
 * Never throws — a probe failure degrades every language to English audio,
 * which the UI then labels, rather than leaving the feature broken.
 */
export async function probeVoices(langMeta: LangMeta): Promise<VoiceMap> {
  let voices: Speech.Voice[] = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch {
    voices = [];
  }

  const map: VoiceMap = {};
  for (const [code, meta] of Object.entries(langMeta)) {
    const requested = meta.tts ?? ENGLISH_FALLBACK;

    // langMeta declaring en-US for a non-English language is the source's way
    // of saying "no voice exists for this language" (hmn). Treat it as a
    // fallback, not as a native voice, so the UI labels it honestly.
    const declaredAsEnglish =
      code !== 'en' && primarySubtag(requested) === 'en';

    if (declaredAsEnglish) {
      map[code] = { hasNativeVoice: false, spokenLanguage: ENGLISH_FALLBACK, requested };
      continue;
    }

    const want = requested.toLowerCase();
    const wantPrimary = primarySubtag(requested);

    const exact = voices.find((v) => v.language?.toLowerCase() === want);
    const loose = exact
      ?? voices.find((v) => primarySubtag(v.language ?? '') === wantPrimary);

    if (loose) {
      map[code] = {
        hasNativeVoice: true,
        spokenLanguage: loose.language ?? requested,
        ...(loose.identifier ? { voiceIdentifier: loose.identifier } : {}),
        requested,
      };
    } else {
      map[code] = { hasNativeVoice: false, spokenLanguage: ENGLISH_FALLBACK, requested };
    }
  }
  return map;
}

export type SpeakInput = {
  // Text in the user's selected language, when the question has one.
  localized?: string | undefined;
  // Always present. Used verbatim whenever we fall back to English audio.
  english: string;
};

/**
 * Speak one piece of quiz text. Stops anything already speaking so repeated
 * taps replace rather than queue.
 */
export function speak(
  input: SpeakInput,
  lang: LangCode,
  voices: VoiceMap,
): void {
  const status = voices[lang];
  const useNative =
    status?.hasNativeVoice === true &&
    typeof input.localized === 'string' &&
    input.localized.length > 0;

  const text = useNative ? (input.localized as string) : input.english;
  const language = useNative ? status.spokenLanguage : ENGLISH_FALLBACK;
  const voiceId = useNative ? status.voiceIdentifier : undefined;

  try {
    Speech.stop();
  } catch {
    // stop() on an idle engine is a no-op on every platform we ship.
  }

  Speech.speak(text, {
    language,
    // Slightly under natural pace — this is study material, and the real
    // USCIS officer speaks deliberately too.
    rate: 0.9,
    pitch: 1.0,
    ...(voiceId ? { voice: voiceId } : {}),
  });
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // no-op
  }
}

/**
 * True when this language will be read aloud in English rather than its own
 * voice — drives the visible "Audio in English" note. English itself is
 * never labelled.
 */
export function isEnglishAudioFallback(lang: LangCode, voices: VoiceMap): boolean {
  if (lang === 'en') return false;
  const status = voices[lang];
  // Before the probe resolves we have no entry; assume native so we do not
  // flash a note that then disappears.
  if (!status) return false;
  return !status.hasNativeVoice;
}
