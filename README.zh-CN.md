# Paper Notes

[English](README.md) | [简体中文](README.zh-CN.md)

littlewei 的公开论文阅读索引。它不追求保存完整摘要，而是长期积累机制、证据、疑问和个人判断。

公开网站：<https://zhw-zhang.github.io/paper-notes/>

站点提供铺平卡片、搜索、标签、阅读/编辑/创建时间排序、明暗主题、子窗口/全窗口阅读、桌面和移动目录、深链接、引用复制、Markdown 下载、打印 PDF、公式、五种彩色提示块，以及每篇独立的作品与许可说明。

当前公开分支只保留 littlewei 自己整理的笔记和原创使用指南。项目的软件部分改写自 [lawrence-cj/paper-recap](https://github.com/lawrence-cj/paper-recap)，遵循仓库中的 MIT License；上游笔记和图片没有包含在当前公开分支。笔记内容适用各自元数据中的单独许可，详见 [COPYRIGHT](COPYRIGHT)。

## 推荐工作流：VS Code 本地编辑和预览

只需要 Git 和 Python 3。推荐用 VS Code 打开整个仓库：

```bash
code "/Users/zhwzhang/Nutstore Files/我的坚果云/2 individual/future_me/paper-notes"
```

在 VS Code 里选择“终端 → 运行任务 → Paper Notes：本地预览”。浏览器会自动打开 <http://localhost:8000>。保存 Markdown、图片或样式后，脚本会自动重建站点并刷新浏览器；按 `Control+C` 停止。这一过程完全发生在本机，不会推送到 GitHub。

不使用 VS Code 时，也可手工运行：

```bash
cd "/Users/zhwzhang/Nutstore Files/我的坚果云/2 individual/future_me/paper-notes"
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

浏览器打开 <http://localhost:8000>。公式依赖 jsDelivr 上的 KaTeX，本地显示公式时需要联网。

## 在 VS Code 新建第一篇笔记

复制模板到仅本地目录，并用阅读日期和稳定英文 slug 命名：

```bash
mkdir -p content/private
cp content/TEMPLATE.md content/private/2026-08-12-example-paper.md
```

填写书目信息、阅读时间、创建/编辑时间、标签、one-liner、论文许可、笔记许可和分享状态。模板提供 `研究问题`、`核心方法`、`关键发现`、`我的提问`、`局限与疑问`、`我的判断`、`下次只看这些` 七个推荐章节；不需要的章节可以直接删除，不影响预览和发布。

卡片左上角来自 `status`，右上角来自 `read_date`。`created_at` 和 `updated_at` 分别用于“最新创建”和“最近编辑”排序，时间都使用带时区的 ISO 8601 格式。

草稿阶段保持：

```yaml
note_author: "littlewei"
note_license: "All Rights Reserved"
sharing: "private"
```

准备公开时：

1. 删除私人、公司内部、未公开或敏感信息。
2. 从论文、出版方或项目官方页面确认 `paper_license` 和 `paper_license_url`。无法确认时写 `未明确开放许可`，不要推测。
3. 确认每张转载图的公开使用许可；不明确时删图并链接原始页面。
4. 运行本地可见性管理器，把笔记切换为公开；它会同步修改 `sharing` 并将文件移动到 `content/papers/`：

```bash
python3 scripts/manage_visibility.py
```

管理页支持逐篇切换、同一 tag 全公开/全隐藏，以及全部公开/全部仅本地。按钮只改本地文件，不会自行上传。

5. 在 VS Code 中保存并通过本地预览确认排版，然后运行：

```bash
python3 scripts/build_site.py --check-public-repo
python3 scripts/build_site.py --public
python3 -m http.server 8001 --directory dist-public
```

确认无误后，先用 `git status --short` 查看范围，只添加本次笔记和图片，再提交并推送 `main`：

```bash
git status --short
git add content/papers/2026-08-12-example-paper.md
git add content/media/example-paper/
git commit -m "content: add example-paper"
git pull --rebase origin main
git push origin main
```

如果不想手工执行上传，可以只让 Codex 负责最后一步：

```text
把我刚才在 VS Code 修改的 Paper Notes 检查后上传；只提交本次改动，并等待 Pages 发布完成。
```

Codex 会校验、提交和推送，不会主动重写你已经改好的笔记。

> [!CAUTION]
> 把曾经公开的笔记移回 `content/private/` 并推送，可以让它从当前网站和仓库文件列表消失，但不能清除 Git 历史。敏感内容必须从一开始就只保存在本地。

## 彩色提示块、公式和图片

章节标题默认使用细分隔线。如果希望某几个标题只显示左侧短色条，在笔记元数据中加入：

```yaml
accent_headings: ["核心方法", "我的判断"]
```

列表里的文字必须与正文二级标题完全一致；不需要强调时写 `accent_headings: []` 或省略。

```markdown
> [!NOTE]
> 背景或补充条件。

> [!TIP]
> 实际使用建议。

> [!IMPORTANT]
> 最值得保留的判断。

> [!WARNING]
> 容易误解的前提。

> [!CAUTION]
> 可能造成错误结论或泄露的边界。
```

行内公式使用 `$x_t$`。独立公式直接使用成对 `$$`，默认没有底板；只有需要突出某个公式时，才把起始行写成 `$$ {.boxed}`。两种写法可以在同一篇笔记中混用。

图片放在 `content/media/<slug>/`，图注只需写明图号、简短说明和来源，不再追加许可或版权状态：

```markdown
![方法总览](media/example-paper/method-overview.webp "论文 Figure 2：方法总览。来源：论文名或单位名。")
```

图片文件要和 Markdown 一起加入 Git。不要把 GitHub 网页编辑器生成的 `<img ...>` 片段再套进 `![...](...)` 里；大幅修改图片时，优先使用 VS Code 和本地预览。

## 临时在网页快速修改（可选）

网站中的“在线编辑”仍适合临时改一两行文字。它会直接提交公开仓库，缺少完整的本地预览，因此不建议用来新建私人草稿、添加图片或大幅调整排版。网站不保存 GitHub Token；写入权限仍完全由 GitHub 账号控制，普通访客不能直接修改正式内容。

> [!CAUTION]
> 这个 GitHub 仓库本身是公开的。私人草稿绝对不要 commit 或 push；只放在被 Git 忽略的本地 `content/private/`。

## 构建与部署

- `python3 scripts/build_site.py`：本地完整预览，合并 `content/papers/` 与 `content/private/`。
- `python3 scripts/build_site.py --public`：只读取 `content/papers/` 并输出到 `dist-public/`。
- `python3 scripts/build_site.py --check-public-repo`：确认 `content/papers/` 中的笔记全部可公开；推送前必须通过。
- `python3 scripts/manage_visibility.py`：打开本地管理页，逐篇、按 tag 或整体切换公开/仅本地。
- `.github/workflows/pages.yml`：每次推送 `main` 后校验并只部署 `dist-public/`。

生成目录 `dist/` 和 `dist-public/` 不提交到 Git，也不要手工编辑。

## 项目结构

```text
paper-notes/
├── .codex/skills/update-paper-notes/  # 新建与发布技能
├── .github/workflows/pages.yml        # GitHub Pages 校验与部署
├── assets/                            # 阅读器逻辑和视觉
├── content/
│   ├── papers/                        # 一篇笔记一个 Markdown
│   ├── private/                       # 被 Git 忽略的仅本地草稿
│   ├── media/                         # 经许可的图片
│   └── TEMPLATE.md
├── scripts/build_site.py              # 校验与构建
├── scripts/manage_visibility.py       # 本地可见性管理页
├── COPYRIGHT
└── LICENSE
```
