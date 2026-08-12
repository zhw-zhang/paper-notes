---
name: update-paper-notes
description: Add, revise, validate, or publish paper-reading notes in littlewei's public Paper Notes repository. Use when the user says “更新到 Paper Notes” or “发布到 Paper Notes”, supplies a paper summary or Agent Q&A to archive, wants to edit an existing recap, or wants to refresh the public paper-reading site.
---

# Update Paper Notes

Turn raw reading notes and Agent conversations into compact, durable public recaps. Optimize for future recall while keeping source, license, and privacy boundaries explicit.

## Workflow

1. Locate the repository root by finding `scripts/build_site.py` and `content/papers/`. Prefer the installed skill's own repository. If absent, clone `https://github.com/zhw-zhang/paper-notes.git` into an appropriate location and run `python3 scripts/install_skill.py` there.
2. Remember that the GitHub repository itself is public. A file committed to Git is public even when its metadata says `sharing: "private"`. Never commit or push sensitive, company-confidential, unpublished, or personal material.
3. Inspect `git status --short --branch`. Never mix unrelated changes into the note commit. When clean, update from `origin/main` with `git pull --ff-only` before editing.
4. Identify the referenced paper from the supplied title, URL, PDF, or context. Verify identity, authors, venue, year, canonical URL, and paper license from authoritative sources. Never infer an open license from free availability. Use `未明确开放许可` with an empty `paper_license_url` when no authoritative license is found.
5. Read `references/note-format.md` before creating or substantially restructuring an entry.
6. Deduplicate by normalized title, canonical URL, DOI, arXiv ID, authors, and slug. Merge matching material into the existing note instead of creating a duplicate. Stop and ask only when paper identity remains genuinely ambiguous.
7. Create or edit exactly one Markdown note in `content/papers/`. Name new files `YYYY-MM-DD-short-kebab-slug.md`; set a timezone-aware `read_at`. Preserve an existing note's original `read_at` unless the user records a new reading session.
8. Set new notes to `note_author: "littlewei"`, `note_license: "All Rights Reserved"`, and `sharing: "private"` while drafting locally. Set `note_source_url` to the future public GitHub file URL.
9. Preserve the user's judgments, disagreements, equations, and only the Q&A that changed understanding. Mark unknowable gaps as `待补充`; never turn inference into fact.
10. Add figures only when they materially shorten recall. Verify reuse permission from an authoritative source and include figure number, source, and license in every caption. If permission is unclear, link to the original instead of copying the image.
11. Use GitHub-style callouts (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`) for standalone colored passages when useful; do not overuse them.
12. Run `python3 .codex/skills/update-paper-notes/scripts/validate_update.py`. Fix every error. Preview locally when layout or formulas changed.
13. Treat “更新到 Paper Notes” and “发布到 Paper Notes” as explicit authorization to make the scoped note public: complete the publication checks, set `sharing: "public"`, run `python3 scripts/build_site.py --check-public-repo` and `python3 scripts/build_site.py --public`, then commit and push. If the user only asks to draft or add a note, keep it local and do not push until publication is explicit.
14. Before every push, verify the note contains no private information, every copied figure is licensed for public use, and every tracked note is marked public. Stage only intended files, commit with `content: add <slug>` or `content: update <slug>`, pull with rebase, revalidate, and push.
15. GitHub Pages deploys `dist-public` automatically after a successful push to `main`. Never deploy `dist/`. If a push loses a concurrent race, pull with rebase and retry once; stop on content conflicts.

## Editing rules

- Keep `one_liner` specific enough to restore the core mechanism six months later.
- Keep two to five focused tags and reuse existing spellings.
- Use concrete result numbers only when supplied or verified.
- Keep important formulas as editable LaTeX and define symbols nearby.
- Make `下次只看这些` one to three memory anchors or actions.
- Do not edit generated `dist/`, `dist-public/`, or `assets/papers.js`.
- Do not reintroduce upstream Junsong Chen notes or media; the public site contains only littlewei material unless separate written authorization and a deliberate user request say otherwise.

## User-facing intake

Accept messy notes. The smallest useful input is:

```text
论文：标题或链接
我的理解：随手写的要点
重要问答：与 Agent 对话中最有价值的 Q&A
我的判断：是否可信、是否值得复现、与当前工作的关系
发布到 Paper Notes：是 / 否
```

Use `待补充` for missing meaning rather than blocking on cosmetic details.
