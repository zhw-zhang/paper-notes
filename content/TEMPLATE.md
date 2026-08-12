<!-- 这是公开仓库：private 草稿可以本地保存，但绝对不要提交或推送。 -->
---
title: "论文完整标题"
paper_url: "https://arxiv.org/abs/..."
authors: "作者，多个作者可写 et al."
venue: "会议 / 期刊 / arXiv"
published: "2026"
read_date: "YYYY-MM-DD"
read_at: "YYYY-MM-DDTHH:MM:SS+08:00"
status: "已精读"
tags: ["主题一", "主题二"]
one_liner: "如果半年后只能记住一句话，就是这一句。"
paper_license: "未明确开放许可"
paper_license_url: ""
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/YYYY-MM-DD-short-slug.md"
sharing: "private"
accent_headings: []
---

## 研究问题

这篇论文试图解决什么问题？为什么重要？

## 核心方法

- 方法的关键机制
- 与已有方法最本质的区别

可选：插入独立的彩色提示块。支持 `NOTE`、`TIP`、`IMPORTANT`、`WARNING` 和 `CAUTION`：

```markdown
> [!NOTE]
> 这是需要单独强调的背景或说明。

> [!IMPORTANT]
> 这是未来回顾时最关键的判断。
```

可选：插入一至三张真正帮助回忆的关键图。图片存放在 `content/media/<paper-slug>/`，正文使用相对于 `content/` 的路径，并在标题中注明图号、来源和许可：

```markdown
![方法总览](media/example-paper/method-overview.webp "论文 Figure 2：方法总览。来源：作者论文，CC BY 4.0。")
```

行内公式使用 `$x_t = f(x_{t-1})$`。独立公式使用：

$$
\mathcal{L}(\theta) = \mathbb{E}_{x \sim p_{\mathrm{data}}}\left[\ell(f_\theta(x), y)\right]
$$

如果不需要灰色底板，在起始分隔符后加 `{.plain}`：

$$ {.plain}
x_t = f(x_{t-1})
$$

## 关键发现

- 最重要的实验结论与必要数字
- 什么证据真正支持作者的主张

## 我的提问

### Q1：我问 Agent 的问题

凝练后的回答，以及它如何改变了我的理解。

## 局限与疑问

- 论文已知局限
- 我仍不确定或不同意的地方

## 我的判断

是否可信、是否值得复现、与当前工作的关系。

## 下次只看这些

1. 最值得快速回忆的点
2. 第二个关键点
3. 需要采取的行动或后续阅读

<!--
公开分享前：
1. 从论文或出版方官方页面确认 paper_license 和 paper_license_url；不确定时保留“未明确开放许可”。
2. 逐张图片确认图注含来源与许可；许可不明确时不要复制图片。
3. 把 sharing 从 private 改为 public。
4. 运行 `python3 scripts/build_site.py --check-public-repo`；不要把 private 草稿提交到公开仓库。
-->
