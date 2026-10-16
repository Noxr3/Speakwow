<div align="center">

<img src="apps/web/public/wow5-logo.png" alt="Speakwow" width="72" />

# Speakwow

**开源的 AI 语音老师，一位真正记得你的家庭老师。**

[English](README.md) · [路线图](docs/ROADMAP.md) · [参与贡献](CONTRIBUTING.md)

</div>

---

## 为什么做

背单词软件会考你，好老师会**了解**你：你最近在练什么、上周说过要考试、今天是不是累了、
什么时候该推一把、什么时候该一起笑。Speakwow 想把这样的老师开源出来，给每一个终身学习的人。

## 它能做什么

- 🎙️ **实时语音对话**：语音直接对语音，老师听得出你的犹豫和兴奋，也会带着情绪回应。默认用
  Grok Voice（`grok-voice-3.0`，固定版本），一个配置就能切到 OpenAI Realtime。专门为「边想边说」
  的学习者放宽了判停时间，不会你一停顿就抢话。
- 🧠 **记得你**：每次通话后自动复盘，记下这节课的总结、你在练的薄弱点、一个好老师会记住的事
  （你的目标、你家猫的名字），并估计你的 CEFR 等级。下次开口就接着上次聊。
- 🧑‍🏫 **是老师，不是聊天机器人**：用「重述」纠错而不是说教，简单时加难度，卡住时搭梯子，
  表扬说得具体。后台还有一个极速「助教」模型，发现你卡住或走神就悄悄提醒老师，不增加任何延迟。
- 🏡 **十位老师，各有各的生活**：Frank、Lucy、Lily、Leo、Kai、Grace、Diego、Priya、Nora、Max，
  口音、教法和擅长方向各不相同（零基础、面试、故事、科学、唱歌……）。每位都有身世和每隔几天推进一格的
  生活线，闲聊是双向的，而且前后一致。首页在一圈动态声纹卡里挑老师，转到谁就能听到谁的声音。
- 📚 **按教材一单元一单元地教**：内置江苏译林版初中英语（新课标）课程大纲。上课模式下老师围绕你最弱的
  单元目标来教，课后给每个目标打分，整单元掌握后自动进入下一单元。
- 🃏 **通话中的卡片和表情包**：老师可以弹出单词卡、选择题、填空、连词成句、跟读句、本课目标，
  也会甩动态表情包；你点的答案和回的表情包会直接传回给老师。
- 🗂️ **学习档案**：课程地图、每单元掌握度、最近的课，以及老师记得的所有事，每一条都可以删除。
- 📞 **打电话、发短信给老师**：在网站上绑定手机号后，可以直接打老师的号码，也可以在两次课之间发短信。同一位老师、同一份记忆：电话里记得你发过的短信，短信里也知道上次通话聊了什么；短信可以换用别的模型。详见 [docs/PHONE_AND_SMS.md](docs/PHONE_AND_SMS.md)。
- 🔑 **自带 API Key（BYOK）**：用你自己的 xAI / OpenAI key。key 在存储或交给语音服务之前就用
  AES-256-GCM 加密，数据库、LiveKit、日志里都不会出现明文。
- 🧩 **方便二次开发**：新增一位老师 = 一个 JSON 文件；新增一门课 = 一个 JSON 文件，或者老师们在
  [Dokki](https://dokki.one) 里共同维护的一张表。第一次跑起来不需要 Supabase。

## 快速开始

需要 Node 22、pnpm 9、Python 3.10+ 和 [uv](https://docs.astral.sh/uv/)、一个
[LiveKit](https://livekit.io) 项目（免费云端，或本地 `livekit-server --dev`），以及一个 xAI 或 OpenAI 的 key。

```bash
git clone https://github.com/Noxr3/Speakwow && cd Speakwow
pnpm install

# 老师（语音 agent）
cd apps/agent && cp .env.example .env.local   # 填 LIVEKIT_* 和 XAI_API_KEY
uv sync && uv run src/agent.py download-files && uv run src/agent.py dev

# 网页（另开一个终端）
cd apps/web && cp .env.example .env.local     # 填 LIVEKIT_*
pnpm dev                                      # http://localhost:3000
```

这样就能以访客身份对话了。要启用账号、记忆和课程，再接上 Supabase：

```bash
supabase start && supabase db reset
pnpm course:import packages/shared/courses/yilin-2024-7a.json
```

全部配置项见英文 README 的 [Configuration](README.md#configuration)。

## 设计取舍

- **默认可移植**：数据库是 Postgres（Supabase 可自托管），实时音视频是 LiveKit（可自托管），
  复盘模型兼容任何 OpenAI 接口。我们刻意没有绑定某一家云的专有数据库或实时服务，
  这样 Speakwow 可以跑在任何地方，包括完全跑在你自己的机器上。
- **对话用语音直出模型，周边用又小又快的模型**：语音模型必须一秒内开口，所以不让它停下来想教学法；
  判断交给只输出概率的决策模型在后台完成，课后记忆交给 flash 模型来写。
- **安全只放在一层**：红线（学习者可能是孩子、不收集个人信息、不给医疗法律建议、被真诚问到时承认是 AI）
  写在共享老师层，人格卡无法覆盖。学生说的话和课程文件内容一律作为数据引用，不会被当成指令。
- **记忆属于学生**：老师记住的一切都在学习档案里可见、可删。

## 参与贡献

最容易上手的三件事：新增一位老师、新增一门课程（只写大纲，**不要搬运教材原文**）、新增一种互动卡片。
详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)，两处例外：`apps/web/components/` 里来自 [React Bits](https://reactbits.dev) 的动效组件
（CircularCarousel、ColorBends、GlassSurface 等）版权归 David Haz，采用 MIT + Commons Clause，可作为应用的一部分使用，
但不能单独出售或再分发组件本身；动态表情来自 Google [Noto Animated Emoji](https://googlefonts.github.io/noto-emoji-animation/)，
CC BY 4.0。web 与 agent 起步于 LiveKit 的 MIT 开源模板。
