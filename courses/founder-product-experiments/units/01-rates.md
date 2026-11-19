---
position: 1
title: 先确认分母
topic: 计算两组转化率，用百分点表述差异。
goals:
  - id: u1-g1
    kind: reasoning
    text: 计算两组转化率，用百分点表述差异。
activities:
  - 用 show_experiment 展示 A 120 人中 12 人转化，B 80 人中 12 人转化。请学生先猜后算，用工具的私有结果核对。
points:
  - 两组各用自己的分母，能正确表述 B 减 A 的百分点差。
sessions:
  - id: learn
    title: 示范与拆解
    kind: lesson
    activity: mixed
    goal_ids:
      - u1-g1
    brief: 先请学生尝试并说明理由，再用小例子演示。用 show_experiment 展示 A 120 人中 12 人转化，B 80 人中 12
      人转化。请学生先猜后算，用工具的私有结果核对。
    minutes: 8
  - id: practice
    title: 换个案例练习
    kind: practice
    activity: mixed
    goal_ids:
      - u1-g1
    brief: 用 show_experiment 展示 A 120 人中 12 人转化，B 80 人中 12 人转化。请学生先猜后算，用工具的私有结果核对。
      每次只提示一步，换个案例请学生自己做。
    minutes: 10
  - id: check
    title: 独立任务
    kind: exam
    activity: experiment
    goal_ids:
      - u1-g1
    brief: 用 show_experiment 展示一组未练过的不同分母数据，只给人数；学生独立计算两组转化率与百分点差。
      等学生提交再评价。判断依据：两组各用自己的分母，能正确表述 B 减 A 的百分点差。
    minutes: 6
review:
  status: draft
  notes: 原创案例，参考课程首页列出的资料。待教学试用。
---
