# Teacher personas

Persona cards describe who a teacher is and how they sound. The public contract
is [`PersonaCard`](../types/index.ts); the browser receives the summaries built in
[`index.ts`](../index.ts). Pedagogy, learner memory, tools and safety rules belong
to the shared [teacher layer](../../../apps/agent/src/teacher.py).

To add a teacher:

1. Copy `frank.json` to a stable lowercase `<id>.json`.
2. Set the name, descriptions, accent, personality, tone examples and teaching style.
3. Choose valid `voices.openai` and `voices.xai` values. The legacy `voice` field is
   not the current provider selector. `voice_note` guides delivery; it does not change
   the underlying voice identity.
4. Add greetings, welcome-backs, guidance, interests and life-story beats. Check
   voice behavior in real conversation rather than only reading the prompt.
5. Supply `look.colors`, `look.motif`, `specialty_en` and a short `sample_line`.
6. Register the card in `PERSONA_CARDS` in `packages/shared/index.ts`.
7. Run `pnpm shared:sync` from the repository root, then the shared-data and Agent checks.

The agent discovers persona JSON files under its generated `shared/personas/`.
Never edit those copies independently. See [Contributing](../../../CONTRIBUTING.md)
for validation and [voice research](../../../docs/VOICE_EXPRESSION_REVIEW.md) for
expression guidance. Static TTS samples use a separate endpoint from live Realtime audio.
