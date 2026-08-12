# Paper Notes

[English](README.md) | [简体中文](README.zh-CN.md)

littlewei's public index of paper mechanisms, evidence, questions, and judgments.

Public site: <https://zhw-zhang.github.io/paper-notes/>

The site includes a flat card index, search, tags, sorting, light/dark themes, modal and full-window reading, responsive tables of contents, stable deep links, citation copying, Markdown downloads, print-to-PDF, KaTeX, five callout styles, and per-note rights information.

The current public branch contains one independently rewritten paper recap and one original usage guide by littlewei, with no upstream notes or media. Software portions were adapted from [lawrence-cj/paper-recap](https://github.com/lawrence-cj/paper-recap) under the included MIT License. Note content has its own per-file license; see [COPYRIGHT](COPYRIGHT).

## Local preview

```bash
python3 scripts/build_site.py
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. KaTeX is loaded from jsDelivr.

## Add and publish a note

Register the repository skill once:

```bash
python3 scripts/install_skill.py
```

Then ask Codex:

```text
Use $update-paper-notes to publish this to Paper Notes:
Paper: https://arxiv.org/abs/xxxx.xxxxx
My understanding: ...
Important Q&A: ...
My judgment: ...
```

The phrases “publish to Paper Notes” and “update Paper Notes” authorize public publication. Draft-only requests stay local with `sharing: "private"` and are not pushed.

This repository is public. A private draft becomes visible if committed even though the Pages build excludes it. Never commit or push private material.

Before publication, verify bibliographic metadata, paper and image licenses, sensitive content, and set `sharing: "public"`. Then run:

```bash
python3 scripts/build_site.py --check-public-repo
python3 scripts/build_site.py --public
```

Pushes to `main` validate the repository and deploy only `dist-public/` through GitHub Pages. Generated `dist/` directories are ignored.

See [README.zh-CN.md](README.zh-CN.md) for the full note format, callout, formula, image, and publication guide.
