# Course library · 课程库

Reviewable curriculum outlines for a conversational tutor. Each course contains
ordered units, stable learning goals and teaching sessions. A voice call can cover
part of a session or several sessions; time spent chatting is not evidence of mastery.

课程以可审读的 Markdown 大纲维护，每门课包含有序单元、稳定目标和课节。
一次通话与一节课并不是同一个概念；闲聊时长不代表掌握程度。

## English for AI Founders · AI 创始人英语

Original task-based drafts for founders speaking with international customers,
investors and partners. Public YC, a16z and Sequoia materials inform the business
tasks; the institutions do not endorse or certify these courses. Read the
[audience research and curriculum design](../docs/AI_FOUNDER_CURRICULUM.md) for
evidence, source mapping, teaching choices and implementation limits.

| Course | Teaching units | Integrated assessments | Sessions |
| --- | --- | --- | --- |
| [B1 · Start the Conversation](ai-founder-english-b1/index.md) | 12 | 3 | 51 |
| [B2 · Lead the Conversation](ai-founder-english-b2/index.md) | 12 | 3 | 51 |
| [C1 · Shape the Conversation](ai-founder-english-c1/index.md) | 12 | 3 | 51 |
| [C2 · Navigate Nuance](ai-founder-english-c2/index.md) | 12 | 3 | 51 |

Each teaching unit contains learning, targeted practice, role application and an
independent check. All eight existing practice forms appear across each course.
CEFR labels describe intended task difficulty; learner testing and scoring
calibration remain pending. The [level alignment review](../docs/AI_FOUNDER_LEVEL_ALIGNMENT.md)
defines task conditions, audits every B1/B2 unit and distinguishes language
performance from business reasoning. Micro-drills alone do not establish the
course's target level.

## Language-skill series · 语言技能系列

Each series contains four topic units and an independent assessment unit. Topic
units include learning, practice and review. These are original curriculum drafts;
see each unit's review status and [course architecture](../docs/COURSE_SERIES.md).

| Course | Practice |
| --- | --- |
| [Everyday conversations](everyday-conversations/index.md) | Role play and real-life situations |
| [Picture conversations](picture-conversations/index.md) | Description, detail and inference |
| [Pronunciation & rhythm](pronunciation-rhythm/index.md) | Listening, shadowing and independent speech |
| [Words in use](words-in-use/index.md) | Meaning, retrieval and vocabulary in context |
| [Listen & write](listen-and-write/index.md) | Audio prompts and typed dictation |
| [Writing workshop](writing-workshop/index.md) | Planning, drafting and revision |
| [Read & discover](read-and-discover/index.md) | Gist, evidence and retelling |
| [Storytelling](storytelling/index.md) | Sequencing, co-creation and independent stories |

## Textbook outlines · 教材大纲

| Course | Units |
| --- | --- |
| [译林版初中英语 七年级上册](yilin-2024-7a/index.md) | 8 |
| [译林版初中英语 七年级下册](yilin-2024-7b/index.md) | 8 |
| [译林版初中英语 八年级上册](yilin-2025-8a/index.md) | 8 |
| [译林版初中英语 八年级下册](yilin-2025-8b/index.md) | 8 |

These are teaching outlines, not copies of textbook passages or exercises. Check
`review.status` and `review.notes` before relying on exact textbook alignment.
`draft` means unchecked; `cross-checked` is not the same as checked against the
textbook itself. The [7A game guide](yilin-2024-7a/GAMES.md) describes short voice-and-card activities.

## Maintain and import · 维护与导入

Read [AGENTS.md](AGENTS.md) for source attribution, stable IDs, review status and
change-log rules. Never copy copyrighted passages or rename published progress IDs.

```bash
pnpm courses:check
pnpm courses:index
pnpm course:import --all --dry-run
```

A maintainer imports approved files with `pnpm course:import --all` after configuring
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the importing shell. Import updates
existing rows by slug/position so student progress is preserved. A file existing in
this repository does not mean it has already been imported into every deployment.
