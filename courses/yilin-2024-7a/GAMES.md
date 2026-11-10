# 语音与卡片小游戏

游戏围绕当节要解决的事展开，每次约 2–3 分钟、一个卡片、两三轮即可。先邀请学生加入，允许拒绝或直接进入任务。游戏结束后撤掉提示，用新的情境做一次独立表达；卡片答对只是练习证据，不能自动代表掌握整个目标。

以下玩法使用现有 `show_widget`、`mark_card` 和 `show_material`。每单元的 `sessions.brief` 已嵌入对应玩法，老师在上课时能够读到；此文件补充规则和制作卡片的例子，不是新增的游戏引擎。

## 可以现在使用的玩法

| 游戏 | 学生怎样玩 | 当前交互 | 语言目标与收尾 |
|---|---|---|---|
| 你说我猜 | 老师口头给两条线索，学生猜词；再互换角色。必要时提供三个选项。 | 语音；需要时 `choice`；揭晓后 `word_card` | 描述含义、组织线索，最后用该词表达自己的意思。 |
| 找到我的队友 | 看三个虚构人物简介，听老师给出的兴趣与时间条件，找到合适队友；随后由学生出题。 | `choice` + 语音解释 | 听关键细节、介绍人物、提出追问；真实交友偏好没有标准答案。 |
| 句子维修站 | 修复一个缺词或乱序句，再改变人物、地点或时间，自己造一个新句。 | `fill_blank` / `reorder` | 语法迁移；不要求学生重复卡片句子来证明掌握。 |
| 校园寻宝 | 根据“能借书的地方”等用途线索匹配地点，再口头带老师到达目的地。 | `match_pairs`，每次 3–4 对 | 地点、功能、代词和路线表达；自由路线由老师理解，不强制唯一答案。 |
| 证据侦探 | 读一段原创短文，判断老师的说法，再指出支持或反驳它的文本线索。 | `reading` 材料 + 一张 `true_false` | 区分文中事实、推断和没说的信息；“没说”题改为三选一，不能强塞进真假二选一。 |
| 抓住老师的错误 | 看共享插画，抓住老师故意说错的一个可见细节；下一轮学生出题。 | `picture` 材料 + `true_false` | 观察、否定和纠错；虚构的故事细节与图中事实分开说。 |
| 时间协调员 | 根据两个时间约束挑出可行安排；老师改变一个条件，学生重新协商。 | `choice` + 自由对话 | 时间介词、频率和澄清；卡片只判断事实约束，不判断喜欢哪项活动。 |
| 野餐装包 | 给食物匹配数量表达，再角色扮演点单；临时改变人数或缺货条件。 | `match_pairs` + 语音 | 可数/不可数名词、数量、礼貌询问；只讨论虚构聚会，不评价身体或体重。 |
| 穿搭侦探 | 按题目给定的天气、颜色和场合找到满足条件的组合，然后向同伴提问。 | `choice` + 语音 | 三类问句与理由表达；个人审美保持开放，不做“正确风格”判分。 |
| 预算小掌柜 | 按价目和预算选一个可行购物篮；下一轮撤掉选项，让学生自己报价和算账。 | `choice`，后接语音协商 | 价格、some/any、there be、取舍理由；金额由老师先核算。 |
| 节庆小记者 | 先播报可见场景，再为想象中的庆祝活动做现场报道，老师追问一个细节。 | `picture` + 语音；需要示范时 `say_it` | 一般现在时与现在进行时；不能把想象出的灯笼或食物说成图片已有的东西。 |

## 每单元的主题游戏

| 单元 | 主题玩法 | 练习后的独立任务 |
|---|---|---|
| 1 · This is me! | 队友侦探、看图纠错 | 介绍新朋友并问一个真实问题。 |
| 2 · Hobbies | 社团配对员、语音猜爱好 | 在没有选项时邀请朋友参加社团。 |
| 3 · Welcome to our school! | 校园寻宝、阅读证据侦探 | 给来访者带路，并说明推荐理由。 |
| 4 · School days | 时间协调员、句子维修站 | 解决一个新的时间冲突。 |
| 5 · A healthy lifestyle | 野餐装包、听单记忆 | 为人数变化后的聚会重新点单。 |
| 6 · My clothes, my style | 穿搭侦探、提问接力 | 根据新场合询问偏好并给建议。 |
| 7 · Be wise with money | 预算小掌柜、价格听辨 | 在更换预算后提出自己的采购方案。 |
| 8 · Let's celebrate! | 节庆小记者、现场纠错 | 主持一段包含追问的庆祝活动介绍。 |

## 反馈与节奏

- 一节课通常选一个最适合的游戏，不要把每个“可选游戏”都串起来。老师可以用熟悉的主题重复玩法，逐步减少提示。
- 第一次错误先由卡片提供提示和重试；老师等卡片完成后回应一次。不要同时口头报出答案。学生用语音作答时，用 `mark_card` 记录原话；识别不清先确认或提供点击方式。
- 默认没有倒计时、扣血、排行榜或强制连胜。可以口头描述“已经找到两条线索”，但不能声称有持久化积分、徽章或跨课游戏进度。
- 开放表达没有唯一标准答案，交给老师交流和反馈。只有答案明确的题才用自动判分卡片；判断多个正确项时显式使用 `answers`。
- 配对和排序按屏幕现有点击交互进行，不宣称支持拖拽、隐藏翻牌或同时操控多张卡。语音识别也不能当作声学准确度评分。
- 学生想聊游戏之外的话题，先接住两三轮，再借一个共同点回到任务；想休息时暂停，不继续出题。
- 测评时不用带提示、重试或答案的游戏卡。用新材料、自由回答和打字收集证据，提交后再反馈；请求帮助则退出测评练习后换题。

## 可直接构造的卡片示例

下面都是本项目原创练习，参数对应当前工具；它们是老师制作同类卡片的例子，并非考试题库。

### Unit 1：句子维修站

```json
{"kind":"fill_blank","title":"Sentence rescue","sentence":"I ___ in Class 3.","options":["am","is","are"],"answer":"am","hint":"Which form goes with I?","explain":"Use am with I."}
```

学生答完后，老师邀请其介绍一个朋友，检查能否自行换用 is。不要继续显示填空答案。

### Unit 3：校园寻宝

```json
{"kind":"match_pairs","title":"Campus clue hunt","pairs":["borrow a book = library","eat lunch = dining hall","play basketball indoors = gym","read an announcement = noticeboard"],"hint":"Match each activity to the place where you can do it.","explain":"These clues describe the purpose of each place."}
```

匹配后由学生选择两个地点，口头带来访者游览；不为开放路线生成固定答案。

### Unit 4：时间协调员

```json
{"kind":"choice","title":"Find a meeting time","question":"Art ends at 3:30. Football starts at 4:00. Our meeting takes 10 minutes. When can it start?","options":["3:20","3:40","3:55"],"answer":"3:40","hint":"The whole meeting must fit between the two activities.","explain":"A 3:40 meeting ends at 3:50, before football."}
```

下一轮把足球时间改到 3:45，让学生口头提出并解释一个新时间，而非重复点选。

### Unit 5：野餐装包

```json
{"kind":"match_pairs","title":"Pack the picnic","pairs":["two whole vegetables = two carrots","one serving of soup = a bowl of soup","one portion of cheese = a piece of cheese","one drink container = a bottle of water"],"hint":"Think about things you can count and containers you can use.","explain":"We count carrots directly and use quantity phrases for soup, cheese and water."}
```

先把配对当作词块练习，再让学生自己给三个人点餐。其他合理的计量表达也可以在口语里接受。

### Unit 6：问句拼装

```json
{"kind":"reorder","title":"Ask the traveller","words":["your","What","is","scarf","colour"],"answer":"What colour is your scarf?","hint":"Begin with What colour, then use is.","explain":"The question asks for a colour, not a yes/no answer."}
```

随后让学生自己问颜色以外的问题；可接受语义明确的不同表述。

### Unit 7：预算小掌柜

```json
{"kind":"choice","title":"Budget mission","question":"Apples cost 4 yuan each; oranges cost 3 yuan each. You have 10 yuan. Which basket can you afford?","options":["2 apples and 1 orange","1 apple and 2 oranges","3 apples"],"answer":"1 apple and 2 oranges","hint":"Add the price of every fruit in each basket.","explain":"The baskets cost 11, 10 and 12 yuan. Only the second fits the budget."}
```

下一轮预算改成 15 元，学生可以提出多种组合。老师核算并交流理由，不再给固定选项。

### Unit 8：抓住现场报道中的错误

先展示现有 park 插画。图里有红色球，以下说法因此可以可靠判为假。

```json
{"kind":"true_false","title":"Spot my mistake","statement":"The ball in the park is blue.","answer":"false","hint":"Look closely at the ball near the child.","explain":"The ball is red, not blue."}
```

让学生改正，再播报一个人物正在做什么；随后才邀请其设计想象中的节庆现场。若看不清图片，改用老师给定的文字事实，不推测学生看到了什么。

## 后续再考虑的交互

隐藏信息的翻牌、倒计时寻物、拖拽整理购物篮和跨课收集册，需要新状态与交互实现，本次没有把它们写成已能玩的能力。先用上面的语音与现有卡片验证学生是否愿意持续参与，再决定是否值得新增组件。
