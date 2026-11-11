export const SPEECH_ATTRIBUTE = 'speakwow.speech';
export const SPEECH_RPC = 'speakwow.set_speech';

export type SpeechPreferences = { speed: number; adaptive: boolean };
export type SpeechState = SpeechPreferences & {
  appliedSpeed: number | null;
  pending: boolean;
  supported: boolean;
  source: 'student' | 'teacher';
  revision: number;
  error: string | null;
};

export const DEFAULT_SPEECH: SpeechPreferences = { speed: 1, adaptive: true };

export function validSpeechSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 1.5;
}

export function normalizeSpeechPreferences(value: unknown): SpeechPreferences {
  const data = value && typeof value === 'object' ? (value as Partial<SpeechPreferences>) : {};
  return {
    speed: validSpeechSpeed(data.speed) ? Math.round(data.speed * 100) / 100 : 1,
    adaptive: typeof data.adaptive === 'boolean' ? data.adaptive : true,
  };
}

export function parseSpeechState(raw: string | undefined): SpeechState | null {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (
      !data ||
      !validSpeechSpeed(data.speed) ||
      (data.appliedSpeed !== null && !validSpeechSpeed(data.appliedSpeed)) ||
      typeof data.adaptive !== 'boolean' ||
      typeof data.pending !== 'boolean' ||
      typeof data.supported !== 'boolean' ||
      !['student', 'teacher'].includes(data.source) ||
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      (data.error !== null && typeof data.error !== 'string')
    )
      return null;
    return data;
  } catch {
    return null;
  }
}

export function newerSpeechState(current: SpeechState | null, next: SpeechState): SpeechState {
  return current && current.revision > next.revision ? current : next;
}

export function speedLabel(speed: number): string {
  return `${Number(speed.toFixed(2))}×`;
}
