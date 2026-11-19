export const SCENES = ['park', 'cafe', 'market', 'station'] as const;
export interface StudyMaterial {
  type: 'material';
  kind: 'picture' | 'reading' | 'writing' | 'dictation' | 'experiment';
  exercise?: string;
  groups?: [number, number][];
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
      !['picture', 'reading', 'writing', 'dictation', 'experiment'].includes(data.kind) ||
      typeof data.title !== 'string'
    )
      return null;
    if (data.kind === 'picture' && !SCENES.includes(data.scene)) return null;
    if (
      data.kind === 'experiment' &&
      (!/^[a-f0-9]{8,32}$/.test(String(data.exercise)) ||
        !Array.isArray(data.groups) ||
        data.groups.length !== 2 ||
        !data.groups.every(
          (g: unknown) =>
            Array.isArray(g) &&
            g.length === 2 &&
            g.every(Number.isSafeInteger) &&
            g[0] >= 1 &&
            g[0] <= 1000000 &&
            g[1] >= 0 &&
            g[1] <= g[0]
        ))
    )
      return null;
    return {
      ...(data.kind === 'experiment' ? { groups: data.groups, exercise: data.exercise } : {}),
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
