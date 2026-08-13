# Paper Notes format

Use UTF-8 Markdown and copy `content/TEMPLATE.md` into `content/private/` for a new draft.

## Public repository boundary

This GitHub repository is public. Keep drafts in the gitignored `content/private/` directory with `sharing: "private"`. Published notes live in `content/papers/` with `sharing: "public"`. Use `python3 scripts/manage_visibility.py` to move notes safely between them. Never stage, commit, or push a private draft. Before publishing, run `python3 scripts/build_site.py --check-public-repo`.

## Frontmatter

Required fields:

- `title`, `paper_url`, `authors`, `venue`, `published`: canonical bibliographic information.
- `read_date`: `YYYY-MM-DD` local date.
- `read_at`: timezone-aware ISO 8601 time for every new note.
- `created_at`: timezone-aware ISO 8601 creation time; preserve it when revising.
- `updated_at`: timezone-aware ISO 8601 last-edit time; refresh it whenever content changes.
- `status`: normally `待读`, `略读`, `已读`, `已精读`, or `复现中`.
- `tags`: two to five stable quoted tags.
- `one_liner`: a specific standalone memory-restoring sentence.
- `paper_license`: exact license stated by the official paper/project page, or `未明确开放许可`.
- `paper_license_url`: official license URL, or an empty string when unconfirmed.
- `note_author`: `littlewei` for new notes.
- `note_license`: `All Rights Reserved` by default.
- `note_source_url`: public GitHub URL of the note once published.
- `sharing`: `private` in `content/private/`; `public` in `content/papers/` only after explicit publication approval and all checks pass.
- `accent_headings` (optional): a list of exact H2 labels that should use the short colored bar style, for example `["核心方法", "我的判断"]`.

Quote all string values, keep one `key: value` per line, and avoid multiline metadata.

## Required sections

Use these headings verbatim and in order:

1. `## 研究问题`
2. `## 核心方法`
3. `## 关键发现`
4. `## 我的提问`
5. `## 局限与疑问`
6. `## 我的判断`
7. `## 下次只看这些`

Avoid an H1 in the body, pasted abstracts, or long chat transcripts.

## Mathematics and callouts

- Use `$...$` for inline math and `$$...$$` for display math.
- Display formulas have no background panel by default. Use `$$ {.boxed}` as the opening delimiter only when a formula needs a shaded panel. `$$ {.plain}` remains valid for older notes but is unnecessary in new writing.
- Keep formulas editable, define symbols nearby, and prefer KaTeX-supported commands.
- Allowed callouts are `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`.

```markdown
> [!IMPORTANT]
> The judgment worth remembering.
```

## Figures and rights

- Store figures in `content/media/<paper-slug>/`; prefer WebP and keep each file under 2 MiB.
- Include descriptive alt text and a quoted caption containing figure number, source, and license or copyright status.
- Add only figures whose authoritative terms permit this public use. Free access alone is not permission.
- If permission is unclear, link to the source instead of copying the figure.
- Keep paper, media, and recap rights separate. Marking a note public does not override third-party rights.

Before publication, verify that the note contains no sensitive material, every copied figure is licensed, paper-license metadata is current, the user explicitly approved publication, and the public-repository check passes.
