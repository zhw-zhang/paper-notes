---
title: "Paper Notes 使用指南：从新建笔记到公开分享"
paper_url: ""
authors: "littlewei"
venue: "Paper Notes"
published: "2026"
read_date: "2026-08-12"
read_at: "2026-08-12T22:55:00+08:00"
status: "使用指南"
tags: ["Tutorial", "Markdown", "Workflow"]
one_liner: "这是一篇可以边看边抄的样式手册：用同一页学习新建、标签、短色条标题、五种提示块、两种公式、分享链接、Markdown 与 PDF。"
paper_license: "不适用（原创教程）"
paper_license_url: ""
note_author: "littlewei"
note_license: "All Rights Reserved"
note_source_url: "https://github.com/zhw-zhang/paper-notes/blob/main/content/papers/2026-08-12-paper-notes-guide.md"
sharing: "public"
accent_headings: ["核心方法", "关键发现"]
---

## 研究问题

Paper Notes 的目标不是把论文全文搬进来，而是让未来的自己快速恢复上下文。这篇指南把站点目前支持的主要写法放在同一页中；首页卡片、标签、子窗口、全窗口、目录和底部许可行也都能直接用本页测试。

普通二级标题会使用一条细分隔线。被列入元数据 `accent_headings` 的标题，则会变成只有左侧短色条的强调样式。

## 核心方法

最简单的方式是直接对 Codex 说：`使用 $update-paper-notes，把这篇论文和我的理解发布到 Paper Notes。` 技能会核对论文、去重、补齐许可、生成 Markdown、校验并推送。

如果只想先写草稿，要明确说“先起草，不发布”。这个仓库本身是公开的，所以 private 草稿不能提交或推送。

手工写作时，可以复制 `content/TEMPLATE.md`，修改开头的书目信息、标签、one-liner 和分享状态，然后完成七个固定章节。

> [!IMPORTANT]
> one-liner 应该在半年后仍能独立恢复论文的核心机制，而不是重复论文标题。

## 关键发现

### 五种彩色提示块

> [!NOTE]
> NOTE 适合背景、术语或不影响主线的补充信息。

> [!TIP]
> TIP 适合实践建议，例如先写一句 one-liner，再展开章节。

> [!IMPORTANT]
> IMPORTANT 适合未来回顾时最值得保留的判断。

> [!WARNING]
> WARNING 适合容易误读的前提、适用范围或发布提醒。

> [!CAUTION]
> CAUTION 适合隐私、版权或可能造成错误结论的高风险边界。

### 公式的两种样式

普通的独立公式带浅色底板，适合需要从正文中明显分离的推导：

$$
V = \frac{M + E + J}{T}
$$

把起始分隔符写成 `$$ {.plain}` 后，公式没有底板，适合更轻的阅读节奏：

$$ {.plain}
t_s^v = q - \left(L_{\mathrm{attn}} - 1 - s\right)
$$

行内公式仍然直接写在句子里，例如 $N_s + N_r = L_{\mathrm{attn}}$。

### 标签、图片与链接

标签写在元数据的 `tags` 列表中，会同时出现在首页筛选器和卡片底部。建议每篇保留两到五个稳定主题，不要把整句话做成标签。

图片放到 `content/media/<paper-slug>/`，并在图注中逐张写明图号、来源和许可。只有公开可复用且真正帮助回忆的图才应该复制；许可不清楚时，改为链接到[论文原始页面](https://arxiv.org/)。

## 我的提问

### Q1：怎样得到可以分享的单篇链接？

打开笔记后点击“复制链接”。链接使用稳定的 `#paper=<slug>` 结构；GitHub Pages 发布完成后，任何人都可以直接打开它。

### Q2：怎样保存 Markdown 或 PDF？

顶部工具栏的“下载 Markdown”保存原始笔记；“打印 / PDF”打开浏览器打印面板，在目标打印机中选择“另存为 PDF”。打印模式只输出当前笔记。

### Q3：什么时候切到全窗口？

快速浏览时保留居中子窗口；长文阅读、使用右侧目录或打印前检查版式时，切换到全窗口更舒服。移动端则使用可展开目录。

## 局限与疑问

- 站点不会替你获得转载授权；公开可访问不等于允许复制论文正文或图片。
- `sharing: "private"` 只影响 Pages 构建，不能让已经提交到公开 GitHub 仓库的文件变私密。
- 公式通过 KaTeX 渲染，本地预览公式时需要联网加载样式文件。
- 当前 Markdown 渲染器有意保持轻量，复杂表格或自定义 HTML 应先在本地检查。

> [!WARNING]
> 发布前删除私人、公司内部、未公开和敏感信息；不确定能否公开时，先保留在未提交的本地草稿中。

## 我的判断

一篇好的 Paper Notes 应该短到可以快速回顾，又长到能留下自己的判断。标签负责跨论文检索，提示块负责局部强调，公式和图片只服务于恢复机制；它们不应该把笔记重新变成论文全文。

## 下次只看这些

1. 新建内容优先使用 `$update-paper-notes`；手工写时从 `content/TEMPLATE.md` 开始。
2. 用 `accent_headings` 选择短色条标题，用五种 callout 表达不同强度的信息。
3. 独立公式默认有底板，`$$ {.plain}` 使用透明底；发布前始终检查来源、许可和隐私。
