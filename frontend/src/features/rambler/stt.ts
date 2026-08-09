import { useCallback, useRef, useState } from "react";

type SpeechModule = typeof import("expo-speech-recognition");

/** `expo-speech-recognition` resolves its native module the moment the package
 * is imported — `requireNativeModule` throws when the binary does not carry it
 * — so a dev client built before the module was added dies on the *import*
 * rather than on the first press, taking the whole `/rambler` route with it.
 * Requiring it defensively turns that into a fact the screen can draw: the
 * "typing works" fallback below is only reachable because of this.
 *
 * A missing module means the dev client needs rebuilding (`eas build --profile
 * development`); the JS half ships in the bundle either way. */
const speech: SpeechModule | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-speech-recognition") as SpeechModule;
  } catch {
    return null;
  }
})();

/** Stands in for the real hook when the module is absent, so the hook is still
 * called unconditionally. `speech` is decided once per process, so this branch
 * cannot change between renders and hook order stays put. */
const useSpeechRecognitionEvent: SpeechModule["useSpeechRecognitionEvent"] =
  speech?.useSpeechRecognitionEvent ?? (() => {});

/** Live transcription, normalized across platforms. iOS delivers one
 * cumulative transcript per session; Android's continuous mode closes a
 * segment on every final result and starts a new one. Keeping finalized
 * segments apart from the interim tail makes both read the same. */
export function useRambleSpeech(onTranscript: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [denied, setDenied] = useState(false);
  const segmentsRef = useRef<string[]>([]);
  const interimRef = useRef("");

  const emit = useCallback(() => {
    const parts = [...segmentsRef.current];
    if (interimRef.current) parts.push(interimRef.current);
    onTranscript(parts.join(" ").replace(/\s+/g, " ").trim());
  }, [onTranscript]);

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript ?? "";
    if (event.isFinal) {
      if (transcript) segmentsRef.current.push(transcript);
      interimRef.current = "";
    } else {
      interimRef.current = transcript;
    }
    emit();
  });

  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));

  const start = useCallback(async (seed?: string) => {
    if (!speech) return;
    const permission = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    // Anything already typed stays; the session speaks onto the end of it.
    segmentsRef.current = seed ? [seed] : [];
    interimRef.current = "";
    speech.ExpoSpeechRecognitionModule.start({
      interimResults: true,
      continuous: true,
    });
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    speech?.ExpoSpeechRecognitionModule.stop();
    setListening(false);
  }, []);

  const available = speech?.ExpoSpeechRecognitionModule.isRecognitionAvailable() ?? false;

  return { available, listening, denied, start, stop };
}
