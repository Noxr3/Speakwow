export const SCENES = ['park', 'cafe', 'market', 'station'] as const;
export interface StudyMaterial {
  type: 'material';
  kind: 'picture' | 'reading' | 'writing' | 'dictation';
  title: string;
  text: string;
  prompt: string;
  scene: (typeof SCENES)[number] | null;
}
export function parseMaterial(payload: Uint8Array): StudyMaterial | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (
      data?.type !== 'material' ||
      !['picture', 'reading', 'writing', 'dictation'].includes(data.kind) ||
      typeof data.title !== 'string'
    )
      return null;
    if (data.kind === 'picture' && !SCENES.includes(data.scene)) return null;
    return {
      type: 'material',
      kind: data.kind,
      title: data.title.slice(0, 100),
      text: data.kind === 'dictation' ? '' : String(data.text ?? '').slice(0, 2400),
      prompt: String(data.prompt ?? '').slice(0, 300),
      scene: data.kind === 'picture' ? data.scene : null,
    };
  } catch {
    return null;
  }
}
