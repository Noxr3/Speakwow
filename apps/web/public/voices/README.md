# Teacher voice samples

Optional static TTS previews generated from each persona's `sample_line`:

```bash
pnpm voices:generate --provider openai --only frank
```

Set the corresponding provider key in the shell. The generator currently defaults
to xAI unless `--provider openai` is supplied; existing files are skipped unless
`--force` is passed. See `scripts/voice-samples.mjs` at the repository root.

The current teacher menu uses short written introductions and does not autoplay
these files. Samples are separate from the Realtime classroom; a TTS preview does
not establish the quality or expression of a live call.
