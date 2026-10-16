/** A short paragraph of the newest complete facts, without inventing a profile.
 * The full memory stays available in the editor; the brief is never persisted
 * as a second source of truth, so edits and forgetting are reflected at once.
 */
export function memorySummary(memories: { content: string }[]): string {
  const sentences: string[] = [];
  const seen = new Set<string>();
  let length = 0;
  for (const memory of memories) {
    const content = memory.content.replace(/\s+/g, ' ').trim();
    if (!content || seen.has(content.toLocaleLowerCase())) continue;
    seen.add(content.toLocaleLowerCase());
    const sentence = /[.!?。！？…]["'”’）)]?$/.test(content) ? content : `${content}.`;
    // Keep the first fact whole even if it exceeds the preferred paragraph length.
    if (sentences.length && length + sentence.length + 1 > 600) continue;
    sentences.push(sentence);
    length += sentence.length + 1;
    if (sentences.length === 3) break;
  }
  return sentences.join(' ');
}
