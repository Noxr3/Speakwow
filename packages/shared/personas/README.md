# personas/

人格卡 = 纯数据。字段契约见 `../types/index.ts` 的 `PersonaCard` 与
[apps/agent 审读与设计草案](/w/df95afc8-29f3-413c-b0c4-3e1255d055ed/r/3653c652-5b4b-4281-a249-f19ef69514a8) §2.2。

- 人格卡只回答「这个人是谁、怎么说话」；学生数据读写、弱点发现、会话摘要、红线注入全部在 agent 共享老师能力层。
- 新增人设 = 在本目录加一个 JSON 文件 + agent 侧注册。
- 文案来源：[Frank/Lucy 人格卡 v0 草案](/w/df95afc8-29f3-413c-b0c4-3e1255d055ed/r/e5758c20-b88a-4dfa-949e-3b917b42b93a)（Content Designer）。
- `voice` 字段为候选值，C2 实测定稿。
