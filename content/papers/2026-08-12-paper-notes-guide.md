---
title: "Paper Notes 使用指南：从新建笔记到公开分享"
paper_url: ""
authors: "littlewei"
venue: "Paper Notes"
published: "2026"
read_date: "2026-08-12"
read_at: "2026-08-12T22:55:00+08:00"
created_at: "2026-08-12T22:55:00+08:00"
updated_at: "2026-08-13T01:27:54+08:00"
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

Paper Notes 的目标不是把论文全文搬进来，而是让未来的自己快速恢复上下文。这篇指南把站点目前支持的主要写法和完整工作流放在同一页中；你可以用它学习创建第一篇笔记、修改卡片信息、设置可见性、上传发布，以及测试首页卡片、标签、子窗口、全窗口、目录和底部许可行。

普通二级标题会使用一条细分隔线。被列入元数据 `accent_headings` 的标题，则会变成只有左侧短色条的强调样式。

## 核心方法

最简单的方式是直接对 Codex 说：`使用 $update-paper-notes，把这篇论文和我的理解发布到 Paper Notes。` 技能会核对论文、去重、补齐许可、生成 Markdown、校验并推送。

如果只想先写草稿，要明确说“先起草，不发布”。草稿会放在被 Git 忽略的 `content/private/`，不会出现在公开 Pages 构建中。

### 直接在网页新建或修改

公开网站页眉有一个低调的“管理”菜单：

- “新建公开笔记”会打开 GitHub 文件编辑器，并自动填好当前日期、时间、许可字段和七个固定章节。
- “管理公开笔记”用于浏览 `content/papers/` 中的全部公开 Markdown。
- “打开完整网页编辑器”会进入 `github.dev`，适合连续修改多篇笔记。

打开任意笔记后，顶部工具栏的“在线编辑”会精确跳转到当前 Markdown。修改完成后在 GitHub 点击提交，推送到 `main` 后 Pages 会自动校验和发布，不需要本地构建或命令行。

> [!WARNING]
> 网页入口只能创建公开笔记。网站不保存 GitHub Token，GitHub 会检查账号权限；普通访客即使看到编辑入口，也不能直接修改正式仓库。私人、公司内部或未公开内容仍然只能放在未提交的本地草稿中。

### 创建第一篇笔记：推荐方式

准备论文链接和哪怕很零散的理解，然后直接对 Codex 说：

```text
使用 $update-paper-notes，先为这篇论文创建一篇仅本地草稿，不发布：

论文：https://arxiv.org/abs/xxxx.xxxxx
我的理解：……
重要问答：……
我的判断：……
```

Codex 会创建 Markdown、核对论文与许可并运行校验。你确认内容以后，再说：`把这篇笔记设为公开并上传到 Paper Notes。`

### 创建第一篇笔记：手工方式

在仓库目录运行：

```bash
mkdir -p content/private
cp content/TEMPLATE.md content/private/2026-08-12-my-first-paper.md
```

文件名使用“阅读日期 + 简短英文 slug”。打开新文件后，至少修改标题、论文链接、作者、标签、one-liner、许可和正文七个章节。

卡片左上角的文字来自 `status`，右上角日期来自 `read_date`，都可以逐篇修改。例如：

```yaml
read_date: "2026-08-12"
read_at: "2026-08-12T21:30:00+08:00"
created_at: "2026-08-12T21:30:00+08:00"
updated_at: "2026-08-12T22:10:00+08:00"
status: "已精读"
```

`created_at` 用于“最新创建”排序，`updated_at` 用于“最近编辑”排序；修改正文时同步更新 `updated_at`。`status` 可以写“待读”“略读”“已读”“已精读”“复现中”或自己的短标签。

### 本地预览

```bash
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

浏览器打开 `http://localhost:8000`。本地完整构建会同时显示公开笔记和 `content/private/` 中的草稿。

### 设置单篇、标签或全部可见性

```bash
python3 scripts/manage_visibility.py
```

命令会打开仅供本机使用的管理页。你可以：

- 对一篇笔记点击“公开”或“仅本地”。
- 对同一个 tag 点击“全公开”或“全隐藏”。
- 点击“全部公开”或“全部仅本地”。

管理页会同时修改 `sharing` 和文件位置：公开内容放在 `content/papers/`，仅本地内容放在被 Git 忽略的 `content/private/`。这些按钮只修改电脑上的文件，不会自行上传。

> [!CAUTION]
> 已经推送到公开 GitHub 的内容可能仍留在 Git 历史中。真正敏感的笔记必须从一开始就放在 `content/private/`，不要提交或推送。

### 上传公开笔记

最简单的方式是告诉 Codex：`把已经设为公开的笔记检查后上传到 Paper Notes。` 它会执行公开边界检查、构建、提交、推送并等待 Pages 完成。

手工上传前先运行：

```bash
python3 scripts/build_site.py --check-public-repo
python3 scripts/build_site.py --public
```

确认无误后，只提交 `content/papers/` 中准备公开的笔记和相关改动，再推送到 `main`。把示例文件名换成自己的：

```bash
git add content/papers/2026-08-12-my-first-paper.md
git commit -m "content: add my-first-paper"
git pull --rebase origin main
git push origin main
```

如果笔记包含已确认许可的图片，也要明确加入对应的 `content/media/<slug>/`。`content/private/` 已被 Git 忽略，不应进入提交。推送完成后，GitHub Pages 会自动构建公开网站。

无论用哪种方式，正文都应完成七个固定章节。

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

### Q4：设为“仅本地”后，网页会立刻消失吗？

不会。本地管理页只改电脑上的文件；需要再次提交并推送，Pages 才会更新。如果文章曾经公开过，当前网页可以移除，但旧版本仍可能留在 Git 历史中。

### Q5：首页卡片上方的状态和日期能改吗？

可以。左侧读取 `status`，右侧读取 `read_date`。它们是每篇 Markdown 开头的元数据，不同笔记可以各自设置；位置属于统一卡片版式，若想整体换位置则修改站点模板。

## 局限与疑问

- 站点不会替你获得转载授权；公开可访问不等于允许复制论文正文或图片。
- `sharing` 与文件目录必须匹配：`content/papers/` 使用 `public`，`content/private/` 使用 `private`。
- 将已经公开的文章改为仅本地，不能抹去 Git 历史里的旧版本。
- 公式通过 KaTeX 渲染，本地预览公式时需要联网加载样式文件。
- 当前 Markdown 渲染器有意保持轻量，复杂表格或自定义 HTML 应先在本地检查。

> [!WARNING]
> 发布前删除私人、公司内部、未公开和敏感信息；不确定能否公开时，先保留在未提交的本地草稿中。

## 我的判断

一篇好的 Paper Notes 应该短到可以快速回顾，又长到能留下自己的判断。标签负责跨论文检索，提示块负责局部强调，公式和图片只服务于恢复机制；它们不应该把笔记重新变成论文全文。

## 下次只看这些

1. 公开内容可以从页眉“管理”直接在 GitHub 网页端新建；需要核对论文或保留私人草稿时优先使用 `$update-paper-notes`。
2. 用 `scripts/manage_visibility.py` 逐篇、按 tag 或整体切换可见性；按钮只改本地，推送后网页才更新。
3. `status` 和 `read_date` 控制卡片顶部，`created_at` 与 `updated_at` 支持创建/编辑时间排序。
4. 用 `accent_headings` 选择短色条标题，用五种 callout 表达不同强度的信息。
5. 独立公式默认有底板，`$$ {.plain}` 使用透明底；发布前始终检查来源、许可和隐私。
