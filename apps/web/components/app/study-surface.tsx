'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useChat, useDataChannel } from '@livekit/components-react';
import { type StudyMaterial, parseMaterial } from '@/lib/study-material';

export function StudySurface({
  transcriptOpen,
  onView,
}: {
  transcriptOpen: boolean;
  onView: () => void;
}) {
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [draft, setDraft] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const { send } = useChat();
  useDataChannel('speakwow.material', (message) => {
    const next = parseMaterial(message.payload);
    if (next) {
      setMaterial(next);
      setShowChart(false);
      setDraft('');
      setSubmitted(false);
    }
  });
  if (transcriptOpen) {
    return material ? (
      <button
        type="button"
        onClick={onView}
        className="text-primary mx-auto min-h-11 shrink-0 px-4 text-sm"
      >
        View lesson material
      </button>
    ) : null;
  }
  return (
    <>
      {material && (
        <section
          aria-label="Lesson material"
          className="border-border bg-card absolute inset-x-4 top-1 bottom-16 z-30 mx-auto flex max-w-xl flex-col overflow-auto rounded-3xl border p-5 shadow-2xl sm:p-7"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="pt-2 text-xl font-semibold">{material.title}</h2>
            <button
              aria-label="Close material"
              onClick={() => setMaterial(null)}
              className="text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>
          {material.kind === 'picture' && (
            <Image
              width={640}
              height={360}
              src={`/scenes/${material.scene}.svg`}
              alt={`Illustrated ${material.scene} scene for discussion`}
              className="mb-4 w-full rounded-2xl"
            />
          )}
          {material.exercise && (
            <form
              className="order-last flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draft.trim() || sending) return;
                setSending(true);
                try {
                  await send(`A/B [${material.exercise}]: ${Number(draft)} pp`);
                  setSubmitted(true);
                } catch {
                  toast.error('Could not send your answer. Try again.');
                } finally {
                  setSending(false);
                }
              }}
            >
              <label>
                转化率差 B − A（百分点）
                <input
                  type="number"
                  step="0.01"
                  min="-100"
                  max="100"
                  required
                  className="field mt-2"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSubmitted(false);
                  }}
                />
              </label>
              <button className="text-primary min-h-11 px-3" disabled={sending || submitted}>
                {submitted ? '已提交' : '提交'}
              </button>
            </form>
          )}
          {material.groups && (
            <table className="mb-5 w-full text-left tabular-nums">
              <caption className="sr-only">Experiment results</caption>
              <thead>
                <tr>
                  <th>分组</th>
                  <th>人数</th>
                  <th>转化数</th>
                </tr>
              </thead>
              <tbody>
                {material.groups.map(([total, success], i) => (
                  <tr key={i}>
                    <th scope="row">{i === 0 ? 'A' : 'B'}</th>
                    <td>{total}</td>
                    <td>{success}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {material.groups && (
            <div className="mb-4">
              <button
                type="button"
                aria-expanded={showChart}
                className="text-primary min-h-11 text-sm"
                onClick={() => setShowChart(!showChart)}
              >
                {showChart ? '收起图表' : '比较转化率'}
              </button>
              {showChart &&
                material.groups.map(([total, success], i) => (
                  <div key={i} className="my-2 flex items-center gap-3">
                    <span>{i === 0 ? 'A' : 'B'}</span>
                    <meter
                      aria-label={i === 0 ? 'A 组转化率' : 'B 组转化率'}
                      min={0}
                      max={total}
                      value={success}
                      className="w-full"
                    />
                  </div>
                ))}
            </div>
          )}
          {material.text && (
            <p className="mb-5 text-base leading-relaxed whitespace-pre-wrap">{material.text}</p>
          )}
          {material.prompt && (
            <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{material.prompt}</p>
          )}
          {['writing', 'dictation'].includes(material.kind) && (
            <form
              className="flex flex-1 flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.trim() || sending) return;
                setSending(true);
                try {
                  await send(draft.trim());
                  setSubmitted(true);
                } catch {
                  toast.error('Your writing was not sent. Please try again.');
                } finally {
                  setSending(false);
                }
              }}
            >
              <label htmlFor="study-writing" className="sr-only">
                Your writing
              </label>
              <textarea
                id="study-writing"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSubmitted(false);
                }}
                maxLength={4000}
                rows={5}
                placeholder={
                  material.kind === 'dictation' ? 'Write what you hear…' : 'Start writing…'
                }
                className="field min-h-32 flex-1 resize-y leading-relaxed"
              />
              <button
                disabled={!draft.trim() || sending || submitted}
                className="bg-primary text-primary-foreground min-h-11 self-end rounded-full px-5 text-sm font-medium disabled:opacity-50"
              >
                {submitted ? 'Sent to your teacher' : sending ? 'Sending…' : 'Share writing'}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
