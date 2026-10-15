# Roadmap

What is shipped, what is next, and where help is most welcome. Items marked
**help wanted** are good for a first or second contribution.

## Shipped

- Real-time voice teacher on LiveKit, Grok Voice by default, OpenAI Realtime optional
- Learner-friendly turn-taking (longer silence on xAI, semantic VAD on OpenAI)
- Ten teachers with lives that move forward over time, picked on a 3D ring of animated voiceprint cards
- Shared teacher layer: pedagogy, red lines, language policy
- Long-term memory: summaries, facts, weaknesses, estimated CEFR level, all erasable
- Coaching sidecar (Jev decision model) that steers the teacher without latency
- Courses and a learning record; lesson mode scores unit goals and advances units
- Teaching cards (word, choice, fill-the-gap, sentence builder, say-it, goals) and stickers
- Bring your own key, sealed with AES-256-GCM end to end
- Course import from a JSON file or a Dokki table

## Next

- **Demo you can try without an account** (hosted, BYOK required)
- **Pronunciation scoring** for say-it cards (Azure Speech or an open model) — help wanted
- **Text mode** for when you cannot speak out loud — help wanted
- **More teachers**: a Chinese tutor for foreign learners, a Japanese tutor — help wanted
- **More courses**: Yilin 7B onward, PEP, IELTS speaking topics — help wanted
- **Docker Compose** for a fully self-hosted stack (LiveKit + Supabase + agent + web) — help wanted
- **Spaced review**: weaknesses and words come back on a schedule
- **Parent / teacher view** of a student's learning record (with consent)
- **Sandboxed custom cards**: model-written HTML in an isolated frame, beyond the typed cards
- **Evaluation suite**: replay real (consented) lessons and score teaching quality

## Not planned

- Ads, selling data, or training models on students' conversations.
