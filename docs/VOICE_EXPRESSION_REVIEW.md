# Speakwow：语音语气与表现力研究

研究日期：2026-11-11。范围是声音里的语调、重音、节奏、轻笑、情绪和跨句连续性；课程流程、轮次检测另行处理。

研究阶段核对了官方文档、LiveKit 示例和测试、开源项目代码及社区一手问题，未进行模型听感盲测。以下研究保留当时的基线；文末记录后续实现状态。

## 结论

其他家的原生 Realtime 可以通过指令引导语气。OpenAI Realtime 的官方示例直接展示多情绪与节奏控制。因此，改善表现力不必先把 Speakwow 改成 STT → LLM → TTS。

建议先用现有 OpenAI Realtime 接入做声音对照实验，再评估 LiveKit 的 expressive TTS 路线。判断依据应是同一句话在真实教学上下文里的录音，而非模型演示或功能清单。

## 迁移前的代码基线

- `apps/agent/src/providers.py` 默认 xAI Realtime；已有 OpenAI Realtime 分支。
- `packages/shared/personas/frank.json`：Frank 的 xAI 音色为 Rex，OpenAI 音色为 cedar；人格描述侧重 energetic、easily excited、react big。
- `apps/agent/src/teacher.py::voice_style`：已有短句、语气示例、少量口语填充；OpenAI 分支有 unhurried、warm 的发声指导。尚未把“鼓励、纠错、示范、闲聊”具体映射为不同的声学表现。
- `apps/agent/uv.lock` 锁定 `livekit-agents` 和 xAI 插件 1.3.12。不能假定当前环境已经具备最新文档中的 expressive API。
- `scripts/voice-samples.mjs` 使用独立 TTS 生成老师预览音频。预览与实时课堂走不同接口，预览好听不能证明课堂中的表现相同。

我的判断：Frank 的设定可能容易产生持续兴奋的单一表演，而不是随语境变化的亲切感。这是待试听验证的假设，不是已经听到的结果。

## 原生 Realtime 能控制什么

| 路线 | 核实的能力 | 使用边界 |
| --- | --- | --- |
| OpenAI Realtime | 自然语言指导人格、情绪、口音和节奏，官方有一段音频内改变情绪的示例 | 属于生成引导，不是逐字音高曲线；播放 speed 与生成时的节奏指导不同 |
| OpenAI GPT-Live | 官方示例进一步区分 voice design 与 personality，包含轻声、丰富表演和速度变化 | 是与普通 Realtime 不同的全双工接入；LiveKit 的控制与工具委托方式也不同，不能当作原模型 ID 的简单替换 |
| Gemini Live | 系统指令可定义声音角色与口音；部分版本有根据输入语气调整回复的 affective dialog | 官方当前表格仅在 2.5 Flash Live 支持该开关，3.1 和 3.8 不支持；不能把旧版本参数复制到新版本 |
| xAI Realtime | 选择基础音色；措辞与上下文塑造整体表达 | 官方提示指南明确限制：instructions 控制语言内容，不保证控制声学情绪切换、音高或说话速度；独立 TTS 标签不能据此推定适用于 Realtime |

来源：[OpenAI Realtime prompting](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)、[GPT-Live prompting](https://developers.openai.com/api/docs/guides/live-prompting)、[LiveKit GPT-Live integration](https://docs.livekit.io/agents/models/realtime/gpt-live/)、[Gemini best practices](https://aistudio.google.com/docs/live-api/best-practices)、[Gemini capabilities](https://aistudio.google.com/docs/live-api/capabilities#affective-dialog)、[xAI Realtime prompting](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/prompting-guide)。

## LiveKit：文档、真实示例与测试

LiveKit 的 [Voice realism 指南](https://docs.livekit.io/agents/start/prompting/#voice-realism)主张把人格写成听得见的表现：有语境的停顿、克制的情绪变化、少量非语言声音、具体示例。平稳底色和局部变化比持续兴奋更适合作为默认策略。英语示范句应保持完整、正确，不能机械套用客服场景的结巴和自我修正。

[Expressive mode](https://docs.livekit.io/agents/models/tts/expressive/) 已将表达控制做成框架能力：向 LLM 提供当前 TTS 支持的标记，转换为供应商格式，合并更完整的语音片段，并从字幕中去掉标记。可限制填充词、笑声、呼吸和语速。它适用于受支持的级联 TTS，不适用于原生 speech-to-speech。

我核对了两处源码，而非只看功能页：

- [LiveKit homepage agent](https://github.com/livekit/agents/blob/87ffc2c1573f6fb871ce6d6444c8b1350938a18e/examples/homepage/livekit-expert/agent.py)：实际用 `inference.TTS` 配合 `expressive=True`。
- [Expressive tests](https://github.com/livekit/agents/blob/87ffc2c1573f6fb871ce6d6444c8b1350938a18e/tests/test_expressive_toggle.py)：覆盖不支持的 TTS 降级、表达指令清理、历史中的标记清理及流式片段边界。

可借鉴：[TTS comparison recipe](https://docs.livekit.io/reference/recipes/tts_comparison/) 保持其他环节一致，切换发声供应商进行对照。对 Speakwow，应固定台词和老师角色，避免把更好的台词误当作更好的声音。

## GitHub 开源项目的具体做法

| 项目 | 核实的机制 | 对 Speakwow 的启发 |
| --- | --- | --- |
| [Sesame CSM](https://github.com/SesameAILabs/csm) | 将历史文字、说话人及音频组成 `Segment`，作为下一句的生成上下文 | 保留情绪与声线的连续性；该开源模型是音频生成模型，不是完整的对话老师 |
| [Pipecat](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/expressive/formatter.py) | ExpressionFormatter 分离可见台词、delivery、声音事件，再转成供应商格式；同一回复内延续 delivery，结束或打断时 reset | 统一“怎么说”的内部表示，同时保持字幕干净；该能力源码标注 alpha |
| [IndexTTS](https://github.com/index-tts/index-tts) | 说话人参考与情绪参考分开；支持情绪强度、向量及文字描述 | 固定 Frank 的身份音色，变化的是这一句的表达；需要另测在线生成延迟 |
| [CosyVoice example.py](https://github.com/QwenAudio/CosyVoice/blob/main/example.py) | 自然语言 instruct、参考音频，以及 breath/laughter 等细粒度控制 | 中英场景可以分别验证，不能假定每种语言的控制效果相同 |
| [Chatterbox](https://github.com/resemble-ai/chatterbox) | 原版有 exaggeration/CFG；Turbo 有 laugh/chuckle 等标签 | 表现强度和发声事件是不同控制项，各变体不能共用一套参数假设 |
| [Fish Speech](https://github.com/fishaudio/fish-speech) | 自然语言内联标签控制局部情绪与韵律，提供多说话人及参考声音机制 | 同一角色的台词中只在有意义的位置改变表达，避免每句都重新设定声音 |
| [Dia](https://github.com/nari-labs/dia) | 用音频条件控制语气，支持非语言声音和对话生成 | 值得参考对话表演，但 README 提醒很短的片段可能不自然，不能直接认定适合老师的短回应 |

Sesame 的[原始研究](https://www.sesame.com/journal/crossing-the-uncanny-valley-of-voice)强调，同一句文字有多种合理读法，需要对话语气和历史帮助选择；自然度与上下文适配应分开评价。

## 社区实践与失败案例

这些是开发者报告，不是已确认适用于所有版本的结论。

- [Chatterbox #136](https://github.com/resemble-ai/chatterbox/issues/136)：项目作者加入分段情绪控制后，发现片段之间衔接可能不自然。启发：不要为了精细控制把一句话切得过碎。
- [Chatterbox #355](https://github.com/resemble-ai/chatterbox/issues/355)：报告旧多语言版本 exaggeration 效果很弱，英文版本不同。启发：按具体模型、语言验收参数。
- [Chatterbox #557](https://github.com/resemble-ai/chatterbox/issues/557)：复现使用 MLX 量化运行时，部分标签被消费却没有可听效果。不能据此宣布所有 Turbo 实现都失败，但它说明“标签没有被朗读”不是控制成功的证据。
- [OpenAI 社区：TTS instructions 变化](https://community.openai.com/t/tts-no-longer-follows-instructions-parameter/1371743)：开发者反馈版本变化后语气遵循度不同，也有人报告重新测试后恢复。这里讨论的是 TTS，不能直接推断当前 Realtime 有同样问题。

建议从这些反馈提炼三项工程要求：固定模型和音色；保存基准录音；升级后对同一批台词重新盲听。不要把提高 temperature、堆很多情绪标签或增加口头禅当成通用解法。

## Frank 的声音设计提案

稳定底色：近距离、自然、放松，有一点笑意；清晰但不逐字播报。情绪变化应围绕学生刚说的内容产生。

| 情境 | 发声意图 | 避免 |
| --- | --- | --- |
| 好奇 | 关键词上轻微抬高音调，短而轻的反应 | 每句都夸张上扬 |
| 鼓励 | 声音稍亮，具体成功处加重音，句尾自然落下 | 每次都大声 Amazing |
| 纠错 | 音量和情绪收一点，只突出目标词 | 审判式、失望式语气 |
| 发音示范 | 暂时慢一点，保留连读和词组节奏；示范后恢复聊天声线 | 全程慢速、逐词读课文 |
| 幽默 | 带一点笑意，偶尔短促轻笑 | 固定每轮笑一次，或在学生出错时笑 |
| 结束 | 稳定下降的句尾，温暖而明确 | 继续维持推销式兴奋 |

下面是拟供支持语气引导的 Realtime 使用的草案，尚未试听验收，不是给所有供应商通用的保证：

```text
Speak to one learner sitting across a small table. Keep your voice relaxed,
warm and lightly animated, with natural variation in pitch and rhythm.
Let curiosity brighten a key word. When acknowledging a real success,
allow a small lift in energy, then settle back to your usual voice.
For a correction, soften your delivery and emphasize only the target word.
When modelling a phrase, slow the phrase slightly while preserving connected
speech, then return to your conversational pace.
Let statements resolve naturally instead of giving every sentence a rising
ending. Use a brief chuckle only when the shared moment is actually funny.
Perform these delivery choices in the audio; never read out directions.
```

## 应怎样验证与选择

先保留 LiveKit 与现有课程系统。用当前 xAI 作为基准，与现有 OpenAI Realtime 接入比较；Gemini Live 作为另一原生语音候选。需要更细控制时，再建立 LiveKit expressive TTS 实验分支，比较 xAI TTS、Fish Audio、Cartesia 或 ElevenLabs 直接插件。ElevenLabs 自己的 expressive mode 与 LiveKit 同名功能是不同产品能力。

独立 TTS 的能力依据：[xAI speech tags](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech#speech-tags)、[Cartesia controls](https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion)、[ElevenLabs expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)。Cartesia 明确将控制定义为引导，情绪标签当前限英语；ElevenLabs 不同模型的速度与 SSML 支持不同。

试听分两组：固定文字只测发声；固定学生输入和教学意图，测实际对话。每种声音重复生成，避免挑一个偶然好样本。

建议最小测试集：欢迎、好奇追问、具体表扬、温和纠错、短句示范、趣味反应、安抚卡壳、结束课程，各两条。额外加入极短回应、连续五轮、英语夹中文和被打断后的续说。

用相同回放音量进行匿名成对比较，分别记录自然度、语气是否贴合语境、是否像同一位老师、清晰度和重复听后的疲劳感。延迟与教学正确性另记，不能用低延迟或干净的转写代替语气验收。

优先级建议：先验证 OpenAI Realtime 的声音指导能否满足需求；再决定是否引入新的发声链路。当前没有证据支持直接宣布某一家听感最好，也不应仅根据上述文档切换生产。

## OpenAI 迁移实现（2026-11-11）

按产品决定，将默认实时语音切为 OpenAI 直连接口，模型为 `gpt-realtime-2.1`；Frank 使用已有的 `cedar` 音色。服务端读取 `OPENAI_API_KEY`，用户明确配置的个人 key 仍选择其对应供应商。无需更换 LiveKit 传输、升级 SDK 或修改课程数据。

OpenAI 专用指令加入好奇、鼓励、纠错、示范、卡壳和幽默对应的发声方式；Frank 的人格改为放松、好奇、轻松活泼，避免持续兴奋。语义判停使用 `eagerness=low`。提示词是引导，不能替代真实录音的听感验收。

离线验证：154 项 Agent 测试、32 项 Web 测试、10 项脚本测试通过；Agent lint、Web lint 和生产构建通过（Web 保留已有警告）。发布前仍需配置生产 `OPENAI_API_KEY`，验证该账号的模型访问和真实音频输出。此处不宣称已经完成生产发布或主观听感验收。
