# Speakwow voice agent

A [LiveKit Agents](https://github.com/livekit/agents) worker that joins each call,
teaches through speech and on-screen tools, and reads/writes learning progress.
The default is OpenAI Realtime (`gpt-realtime-2.1`); Frank uses `cedar`. Explicit
xAI configuration and personal provider choices remain supported.

See the [root setup guide](../../README.md#run-locally). Commands below run from `apps/agent`:

```bash
cp .env.example .env.local   # configure LIVEKIT_* and OPENAI_API_KEY
uv sync --locked
uv run src/agent.py download-files
uv run src/agent.py dev     # local worker connected to LiveKit
```

`uv run src/agent.py console` provides terminal audio. Production uses
`uv run src/agent.py start`. The [Dockerfile](Dockerfile) uses this entrypoint;
the build context is `apps/agent`. Keep provider and database keys server-side.

## Code map

| File | Responsibility |
| --- | --- |
| `src/agent.py` | Signed dispatch metadata, learner snapshot, tools and call lifecycle |
| `src/providers.py` | Provider/model/voice selection and turn detection |
| `src/teacher.py` | Shared teaching rules, vocal delivery, persona, memory and phase instructions |
| `src/personas.py`, `src/life.py` | Teacher data and ongoing life stories |
| `src/intake.py` | First-call interview and learning profile collection |
| `src/curriculum.py`, `src/lesson.py` | Session workflow, goals, assessment and progress |
| `src/memory.py`, `src/reflect.py`, `src/user_memory.py` | Persistence, post-call reflection and memory operations |
| `src/coach.py`, `src/pacing.py` | Optional coaching, silence and breaks |
| `src/widgets.py`, `src/materials.py`, `src/stickers.py` | Structured cards, learning materials and reactions |
| `src/byok.py` | Decrypt the student's sealed provider key |
| `src/sms_server.py` | Optional SMS process; see [Phone and SMS](../../docs/PHONE_AND_SMS.md) |
| `shared/` | Generated copy of persona JSON and stickers used by the agent build |

Edit shared data in `packages/shared`, then run `pnpm shared:sync` from the root.
Do not edit the generated JSON copies. Course definitions live in `courses/` and
are imported separately; they are not baked into the voice model.

## Checks and limits

```bash
uv run ruff check
uv run pytest -m 'not live'
```

Live tests require external model access and may incur API usage. Offline checks
validate code and prompt contracts; they do not measure how a voice sounds. Before
changing a voice model, verify real audio, tool calls, interruptions and lesson
transitions. See [voice research](../../docs/VOICE_EXPRESSION_REVIEW.md) and
[course architecture](../../docs/COURSE_SERIES.md).

The worker began with LiveKit's MIT-licensed starter; see [LICENSE](LICENSE).
