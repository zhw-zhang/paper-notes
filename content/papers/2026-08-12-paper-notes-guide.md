---
title: "Paper Notes 使用指南：从新建笔记到公开分享"
paper_url: ""
authors: "littlewei"
venue: "Paper Notes"
published: "2026"
read_date: "2026-08-12"
read_at: "2026-08-12T22:55:00+08:00"
created_at: "2026-08-12T22:55:00+08:00"
updated_at: "2026-08-14T20:03:30+08:00"
status: "使用指南"
tags: ["Tutorial",]
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

Paper Notes 的日常工作流由你自己掌控：**VS Code 新建和修改 → 本地预览 → 决定是否公开 → 校验并上传**。Codex 只是可选的发布助手，不会取代你对笔记内容的修改和判断。

### 用 VS Code 打开笔记库

在终端运行：

```bash
code "/Users/zhwzhang/Nutstore Files/我的坚果云/2 individual/future_me/paper-notes"
```

或在 VS Code 中选择“文件 → 打开文件夹”，打开 `paper-notes`。之后的新建、编辑、图片管理和本地预览都在这个窗口完成。

### 在 VS Code 创建第一篇笔记

在仓库目录运行：

```bash
mkdir -p content/private
cp content/TEMPLATE.md content/private/2026-08-12-my-first-paper.md
```

文件名使用“阅读日期 + 简短英文 slug”。打开新文件后，至少修改标题、论文链接、作者、标签、one-liner 和许可。模板里的七个正文章节只是推荐结构：不适合这篇笔记的标题可以直接删除，缺少章节不会阻止本地预览或公开构建。

如果是已经准备公开的笔记，也可以直接把模板复制到 `content/papers/`，并把 `sharing` 设为 `"public"`。不确定时默认放入 `content/private/`。

卡片左上角的文字来自 `status`，右上角日期来自 `read_date`，都可以逐篇修改。旁边低调显示的“约 X 分钟”会根据正文的中英文长度自动估算，不需要填写元数据。例如：

```yaml
read_date: "2026-08-12"
read_at: "2026-08-12T21:30:00+08:00"
created_at: "2026-08-12T21:30:00+08:00"
updated_at: "2026-08-12T22:10:00+08:00"
status: "已精读"
```

`created_at` 用于“最新创建”排序，`updated_at` 用于“最近编辑”排序；修改正文时同步更新 `updated_at`。`status` 可以写“待读”“略读”“已读”“已精读”“复现中”或自己的短标签。

### 本地预览

用 VS Code 打开仓库根目录，然后选择菜单“终端 → 运行任务”，再选“Paper Notes：本地预览”。脚本会自动打开 `http://localhost:8000`；保存 Markdown、图片或样式后，站点会自动重建，浏览器也会自动刷新。停止预览时，在任务终端按 `Control+C`。

如果不使用 VS Code，仍可以手工运行：

```bash
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

浏览器打开 `http://localhost:8000`。本地完整构建会同时显示公开笔记和 `content/private/` 中的草稿。

> [!TIP]
> 先在 VS Code 中编辑和本地预览，确认图片、公式和卡片都正常后再推送。本地预览不会自动上传任何内容。

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

本地预览满意后，先查看本次修改了哪些文件，再做发布前校验：

```bash
git status --short
python3 scripts/build_site.py --check-public-repo
python3 scripts/build_site.py --public
```

确认无误后，只加入这次准备公开的 Markdown 和图片，再推送到 `main`。把示例路径换成自己的：

```bash
git add content/papers/2026-08-12-my-first-paper.md
git add content/media/my-first-paper/
git commit -m "content: add my-first-paper"
git pull --rebase origin main
git push origin main
```

如果笔记包含已确认许可的图片，图片文件必须真正保存在 `content/media/<slug>/`，并与 Markdown 一起 `git add`。不要把 GitHub 生成的 `<img ...>` 代码套进 Markdown 图片语法。`content/private/` 已被 Git 忽略，不应进入提交。推送完成后，GitHub Pages 会自动构建公开网站。

> [!TIP]
> 如果你已经在 VS Code 中改好并本地预览过，只是不想手工上传，可以对 Codex 说：**“把我刚才在 VS Code 修改的 Paper Notes 检查后上传；只提交本次改动，并等待 Pages 发布完成。”** Codex 会只负责核对、提交和发布，不重写你的笔记。

### 临时在网页快速修改（可选）

公开网站的“管理”和笔记顶部的“在线编辑”仍然可用，适合临时修正一两行文字。网页编辑会直接提交公开仓库，不能先看本地完整预览，因此不建议用它添加图片或大幅修改排版。

> [!WARNING]
> 网页入口只适合准备立即公开的内容。GitHub 会检查账号权限；普通访客不能直接修改正式仓库，但私人、公司内部或未公开内容仍然不应在网页编辑器中创建。

无论用哪种方式，正文都应完成七个固定章节。

> [!IMPORTANT]
> one-liner 应该在半年后仍能独立恢复论文的核心机制，而不是重复论文标题。

## 关键发现

### 加粗、斜体与下划线

正文中可以使用三种简单强调：

```markdown
**加粗内容**
*斜体内容*
++下划线内容++
```

显示效果分别是：**加粗内容**、*斜体内容*、++下划线内容++。

下划线是 Paper Notes 的自定义语法，写成 `++需要标出的文字++`，适合强调一句话中的局部结论；不要给整段文字都加下划线。

### 五种彩色提示块

标记词只用来选择颜色，网页不会显示“补充”“建议”“关键判断”等小标题。块内文字与正文保持相近的字号：`NOTE` 是蓝色，`TIP` 是绿色，`IMPORTANT` 是紫色，`WARNING` 是黄色，`CAUTION` 是红色。

> [!NOTE]
> 蓝色适合背景、术语或不影响主线的补充信息。

> [!TIP]
> 绿色适合实践建议，例如先写一句 one-liner，再展开章节。

> [!IMPORTANT]
> 紫色适合未来回顾时最值得保留的判断。

> [!WARNING]
> 黄色适合容易误读的前提、适用范围或发布提醒。

> [!CAUTION]
> 红色适合隐私、版权或可能造成错误结论的高风险边界。

如果要把标题和多个段落都放在同一个彩色块里，每一行都要以 `>` 开头，包括段落之间的空行：

```markdown
> [!NOTE]
> **Sparse Attention 的问题**
>
> - 第一个问题。
>
> - 第二个问题。
```

彩色块内支持用 `-` 写项目符号。如果某个空行或段落没有 `>`，它就会离开彩色块，回到普通正文。

### 公式的两种样式

普通的独立公式默认没有底板，直接写 `$$` 即可：

$$
V = \frac{M + E + J}{T}
$$

只有希望公式明显从正文中分离时，才把起始分隔符写成 `$$ {.boxed}`：

$$ {.boxed}
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

可以。左侧读取 `status`，右侧读取 `read_date`。它们是每篇 Markdown 开头的元数据，不同笔记可以各自设置；“约 X 分钟”由正文自动估算。位置属于统一卡片版式，若想整体换位置则修改站点模板。

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
5. 独立公式默认透明，只有 `$$ {.boxed}` 才使用浅色底板；发布前始终检查来源、许可和隐私。
