# Speakwow voice agent

The teacher: a [LiveKit Agents](https://github.com/livekit/agents) worker that
joins each call, speaks through a speech-to-speech model, and remembers the
student between calls. See the [root README](../../README.md) for setup.

| File | What it does |
|---|---|
| `src/agent.py` | Entrypoint: reads the signed job metadata, loads memory, starts the session |
| `src/teacher.py` | The shared teacher layer: pedagogy, red lines, memory block, openings |
| `src/personas.py`, `src/life.py` | Persona cards and the teacher's own life |
| `src/lesson.py` | Lesson mode: the unit plan in the prompt, goal scores, mastery |
| `src/memory.py`, `src/reflect.py` | Snapshot in, transcript + reflection out (Supabase REST) |
| `src/coach.py` | The coaching sidecar (Jev decision model) |
| `src/stickers.py`, `src/widgets.py` | Tools that put stickers and cards on the student's screen |
| `src/providers.py`, `src/byok.py` | Voice model choice and turn-taking; opening a student's sealed key |
| `shared/` | Vendored copy of `packages/shared` for the Docker image (`pnpm shared:sync`) |

```bash
uv sync
uv run src/agent.py download-files   # VAD / noise-cancellation models
uv run src/agent.py console          # talk to it in your terminal
uv run src/agent.py dev              # connect to LiveKit for the web app
uv run ruff check && uv run pytest -m "not live"
```

Started from LiveKit's MIT-licensed agent starter (see `LICENSE` in this folder).
