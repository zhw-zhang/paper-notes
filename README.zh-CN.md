# Paper Notes

[English](README.md) | [简体中文](README.zh-CN.md)

littlewei 的公开论文阅读索引。它不追求保存完整摘要，而是长期积累机制、证据、疑问和个人判断。

公开网站：<https://zhw-zhang.github.io/paper-notes/>

站点提供铺平卡片、搜索、标签、排序、明暗主题、子窗口/全窗口阅读、桌面和移动目录、深链接、引用复制、Markdown 下载、打印 PDF、公式、五种彩色提示块，以及每篇独立的作品与许可说明。

当前公开分支只保留一篇 littlewei 原创功能示例。项目的软件部分改写自 [lawrence-cj/paper-recap](https://github.com/lawrence-cj/paper-recap)，遵循仓库中的 MIT License；上游笔记和图片没有包含在当前公开分支。笔记内容适用各自元数据中的单独许可，详见 [COPYRIGHT](COPYRIGHT)。

## 本地预览

只需要 Git 和 Python 3：

```bash
cd "/Users/zhwzhang/Nutstore Files/我的坚果云/2 individual/future_me/paper-notes"
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

浏览器打开 <http://localhost:8000>。公式依赖 jsDelivr 上的 KaTeX，本地显示公式时需要联网。

## 用 Codex 新建并发布

仓库自带 `$update-paper-notes` 技能。首次注册：

```bash
python3 scripts/install_skill.py
```

以后可以直接说：

```text
使用 $update-paper-notes，把下面内容发布到 Paper Notes：

论文：https://arxiv.org/abs/xxxx.xxxxx
我的理解：……
重要问答：……
我的判断：……
```

“发布到 Paper Notes”或“更新到 Paper Notes”表示你明确同意公开。技能会查重、核对书目信息和官方许可、整理正文、执行公开边界检查、提交并推送；GitHub Pages 随后自动更新。

如果只说“先起草”，技能会保留 `sharing: "private"` 且不会推送。

> [!CAUTION]
> 这个 GitHub 仓库本身是公开的。private 草稿即使不会进入 Pages，只要被提交，仍能从仓库源码看到；私人草稿绝对不要 commit 或 push。

## 手工新建

复制模板，并用阅读日期和稳定英文 slug 命名：

```bash
cp content/TEMPLATE.md content/papers/2026-08-12-example-paper.md
```

填写书目信息、阅读时间、标签、one-liner、论文许可、笔记许可和分享状态。正文固定保留七个章节：`研究问题`、`核心方法`、`关键发现`、`我的提问`、`局限与疑问`、`我的判断`、`下次只看这些`。

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
4. 将 `sharing` 改为 `public`。
5. 运行：

```bash
python3 scripts/build_site.py --check-public-repo
python3 scripts/build_site.py --public
python3 -m http.server 8001 --directory dist-public
```

确认无误后提交并推送 `main`。

## 彩色提示块、公式和图片

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

行内公式使用 `$x_t$`，独立公式使用成对的 `$$`。图片放在 `content/media/<slug>/`，图注必须写明图号、来源和许可：

```markdown
![方法总览](media/example-paper/method-overview.webp "论文 Figure 2：方法总览。来源：作者论文，CC BY 4.0。")
```

## 构建与部署

- `python3 scripts/build_site.py`：本地完整预览，可包含未提交的私人草稿。
- `python3 scripts/build_site.py --public`：只输出明确标为 public 的笔记到 `dist-public/`。
- `python3 scripts/build_site.py --check-public-repo`：确认工作树中的笔记全部可公开；推送前必须通过。
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
│   ├── media/                         # 经许可的图片
│   └── TEMPLATE.md
├── scripts/build_site.py
├── COPYRIGHT
└── LICENSE
```
