---
position: 3
title: 解释样本波动
topic: 区分观察到的差值与关于真实效果的判断。
goals:
  - id: u3-g1
    kind: reasoning
    text: 区分观察到的差值与关于真实效果的判断。
activities:
  - 用 show_experiment 对比 10 人中 2 人与 10 人中 3 人转化。讨论再有一人转化时差值如何变化。
points:
  - 能解释小样本的波动及不确定性，提出事先约定样本或观察窗口。
sessions:
  - id: learn
    title: 示范与拆解
    kind: lesson
    activity: mixed
    goal_ids:
      - u3-g1
    brief: 先请学生尝试并说明理由，再用小例子演示。用 show_experiment 对比 10 人中 2 人与 10 人中 3
      人转化。讨论再有一人转化时差值如何变化。
    minutes: 8
  - id: practice
    title: 换个案例练习
    kind: practice
    activity: mixed
    goal_ids:
      - u3-g1
    brief: 用 show_experiment 对比 10 人中 2 人与 10 人中 3 人转化。讨论再有一人转化时差值如何变化。
      每次只提示一步，换个案例请学生自己做。
    minutes: 10
  - id: check
    title: 独立任务
    kind: exam
    activity: mixed
    goal_ids:
      - u3-g1
    brief: 提供新的一次小流量测试，要求学生向合伙人解释为何领先并不足以决定全量上线。
      等学生提交再评价。判断依据：能解释小样本的波动及不确定性，提出事先约定样本或观察窗口。
    minutes: 6
review:
  status: draft
  notes: 原创案例，参考课程首页列出的资料。待教学试用。
---
