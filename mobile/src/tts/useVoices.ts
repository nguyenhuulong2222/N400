// One-shot voice probe, shared by every screen that speaks.
//
// The probe runs once per app launch. It touches no storage and sends no
// network request — `Speech.getAvailableVoicesAsync()` reads the OS voice
// inventory locally (Invariant VIII).

import { useEffect, useState } from 'react';
import { getLanguages } from '../data/load.ts';
import { probeVoices, type VoiceMap } from './speech.ts';

export function useVoices(): { voices: VoiceMap; ready: boolean } {
  const [voices, setVoices] = useState<VoiceMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void probeVoices(getLanguages()).then((map) => {
      if (cancelled) return;
      setVoices(map);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { voices, ready };
}
