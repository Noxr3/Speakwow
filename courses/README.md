# Courses 课程

What the teacher can teach unit by unit. Each course is a folder of Markdown
pages anyone can improve with a pull request, in any subject. The rules, for
people and AI agents alike, are in [AGENTS.md](AGENTS.md).

老师能按单元教的课程。每门课是一个文件夹，里面是可以直接编辑的 Markdown
页面，任何科目都可以加。维护规则见 [AGENTS.md](AGENTS.md)。

| Course | Subject | Units |
|---|---|---|
| [译林版初中英语 七年级上册](yilin-2024-7a/index.md) | English | 8 |
| [译林版初中英语 七年级下册](yilin-2024-7b/index.md) | English | 8 |
| [译林版初中英语 八年级上册](yilin-2025-8a/index.md) | English | 8 |
| [译林版初中英语 八年级下册](yilin-2025-8b/index.md) | English | 8 |
| [Raising venture capital, from a16z’s published advice](venture-fundraising-a16z/index.md)（按 a16z 公开的方法论学融资） | Venture fundraising | 7 |

**Most wanted:** checking the Yilin units against a printed copy or the
teacher's book (look for `cross-checked` or `draft` in each course's unit
list), and new courses in other subjects.

**最需要的帮助：** 对照纸质课本或教参核对译林各单元（单元表里写着
`cross-checked` 或 `draft` 的都还没对照课本核对过），以及其他科目的新课程。

```bash
pnpm courses:check     # check every course
pnpm courses:index     # regenerate each course's unit list
```
