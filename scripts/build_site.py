#!/usr/bin/env python3
"""Validate paper notes and build the dependency-free static site."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content" / "papers"
PRIVATE_CONTENT_DIR = ROOT / "content" / "private"
MEDIA_DIR = ROOT / "content" / "media"
DIST_DIR = ROOT / "dist"
PUBLIC_DIST_DIR = ROOT / "dist-public"
IMAGE_PATTERN = re.compile(
    r'^!\[([^\]\n]+)\]\((media/[^\s)"\']+\.(?:png|jpe?g|webp))(?:\s+"([^"\n]+)")?\)(?:\{\.(narrow|scale85|scale90)\})?\s*$',
    re.IGNORECASE | re.MULTILINE,
)
REQUIRED_FIELDS = {
    "title", "paper_url", "authors", "venue", "published", "read_date", "read_at",
    "created_at", "updated_at",
    "status", "tags", "one_liner", "paper_license", "paper_license_url",
    "note_author", "note_license", "note_source_url", "sharing",
}
ALLOWED_SHARING = {"private", "public"}


class ContentError(ValueError):
    pass


def estimate_reading_minutes(markdown: str) -> int:
    """Estimate reading time from prose while ignoring non-reading Markdown noise."""
    plain_text = str(markdown)
    plain_text = re.sub(r"```[\s\S]*?```", " ", plain_text)
    plain_text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", plain_text)
    plain_text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", plain_text)
    plain_text = re.sub(r"<[^>]+>", " ", plain_text)
    plain_text = re.sub(r"[#>*_`~$\\{}\[\]()|:-]", " ", plain_text)
    chinese_characters = len(re.findall(r"[\u3400-\u9fff]", plain_text))
    latin_words = len(re.findall(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", plain_text))
    return max(1, math.ceil(chinese_characters / 350 + latin_words / 220))


def collect_images(body: str, slug: str) -> list[dict]:
    media_root = MEDIA_DIR.resolve()
    expected_prefix = f"media/{slug}/"
    images = []
    for match in IMAGE_PATTERN.finditer(body):
        alt_text, relative_path, caption, _figure_style = match.groups()
        if not relative_path.startswith(expected_prefix):
            continue
        media_path = (ROOT / "content" / relative_path).resolve()
        try:
            media_path.relative_to(media_root)
        except ValueError:
            continue
        if not media_path.is_file():
            continue
        images.append({"alt": alt_text or "", "path": relative_path, "caption": caption or ""})
    return images


def parse_scalar(raw: str):
    raw = raw.strip()
    if not raw:
        return ""
    if raw.startswith("[") and raw.endswith("]"):
        try:
            return ast.literal_eval(raw)
        except (SyntaxError, ValueError) as exc:
            raise ContentError(f"无法解析列表 {raw!r}") from exc
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        return raw[1:-1]
    if re.fullmatch(r"-?\d+", raw):
        return int(raw)
    return raw


def parse_note(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not match:
        raise ContentError("必须以 --- 包围的元数据开头")

    metadata = {}
    for line_number, line in enumerate(match.group(1).splitlines(), start=2):
        if not line.strip():
            continue
        if ":" not in line:
            raise ContentError(f"第 {line_number} 行不是 key: value 格式")
        key, raw_value = line.split(":", 1)
        metadata[key.strip()] = parse_scalar(raw_value)

    missing = sorted(REQUIRED_FIELDS - metadata.keys())
    if missing:
        raise ContentError(f"缺少字段：{', '.join(missing)}")
    if not isinstance(metadata["tags"], list) or not metadata["tags"]:
        raise ContentError("tags 必须是至少含一个主题的列表")
    if not all(isinstance(tag, str) and tag.strip() for tag in metadata["tags"]):
        raise ContentError("tags 中的每一项都必须是非空文本")
    accent_headings = metadata.get("accent_headings", [])
    if not isinstance(accent_headings, list) or not all(
        isinstance(heading, str) and heading.strip() for heading in accent_headings
    ):
        raise ContentError("accent_headings 必须是标题文本列表，例如 [\"核心方法\", \"我的判断\"]")
    try:
        datetime.strptime(str(metadata["read_date"]), "%Y-%m-%d")
    except ValueError as exc:
        raise ContentError("read_date 必须使用 YYYY-MM-DD") from exc
    timestamps = {}
    for field in ("read_at", "created_at", "updated_at"):
        try:
            timestamp = datetime.fromisoformat(str(metadata[field]).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ContentError(f"{field} 必须使用带时区的 ISO 8601 时间") from exc
        if timestamp.tzinfo is None:
            raise ContentError(f"{field} 必须包含时区，例如 +08:00")
        timestamps[field] = timestamp
    if timestamps["read_at"].date().isoformat() != str(metadata["read_date"]):
        raise ContentError("read_at 的本地日期必须与 read_date 一致")
    if timestamps["updated_at"] < timestamps["created_at"]:
        raise ContentError("updated_at 不能早于 created_at")
    if not str(metadata["title"]).strip() or not str(metadata["one_liner"]).strip():
        raise ContentError("title 和 one_liner 不能为空")
    for field in ("paper_license", "note_author", "note_license"):
        if not str(metadata[field]).strip():
            raise ContentError(f"{field} 不能为空")
    if metadata["sharing"] not in ALLOWED_SHARING:
        raise ContentError("sharing 只能是 private 或 public")
    expected_sharing = "private" if path.parent == PRIVATE_CONTENT_DIR else "public"
    if metadata["sharing"] != expected_sharing:
        expected_dir = "content/private" if expected_sharing == "private" else "content/papers"
        raise ContentError(f"位于 {expected_dir} 的笔记必须设置 sharing: \"{expected_sharing}\"")
    if metadata["sharing"] == "public" and metadata["note_author"] != "littlewei":
        if metadata.get("publication_permission") != "confirmed":
            raise ContentError(
                "非 littlewei 撰写的笔记公开前必须取得授权，并设置 publication_permission: \"confirmed\""
            )

    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", path.stem)
    body = match.group(2).strip()
    images = collect_images(body, slug)

    metadata["slug"] = slug
    metadata["body"] = body
    metadata["reading_minutes"] = estimate_reading_minutes(body)
    metadata["source_file"] = path.name
    metadata["source_path"] = str(path.relative_to(ROOT))
    metadata["media"] = images
    return metadata


def load_papers(*, include_private: bool = True) -> list[dict]:
    papers, errors, seen_slugs = [], [], set()
    paths = list(CONTENT_DIR.glob("*.md"))
    if include_private and PRIVATE_CONTENT_DIR.exists():
        paths.extend(PRIVATE_CONTENT_DIR.glob("*.md"))
    for path in sorted(paths):
        try:
            paper = parse_note(path)
            if paper["slug"] in seen_slugs:
                raise ContentError(f"slug 重复：{paper['slug']}")
            seen_slugs.add(paper["slug"])
            papers.append(paper)
        except ContentError as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    if errors:
        raise ContentError("\n".join(errors))
    if not papers:
        scope = "content/papers 或 content/private" if include_private else "content/papers"
        raise ContentError(f"{scope} 中没有阅读记录")
    return sorted(
        papers,
        key=lambda item: (item["read_date"], item.get("read_at", ""), item["title"]),
        reverse=True,
    )


def write_data(path: Path, papers: list[dict], build_mode: str) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "build_mode": build_mode,
        "papers": papers,
    }
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(f"window.PAPER_NOTES_DATA = {json_text};\n", encoding="utf-8")


def copy_selected_media(papers: list[dict], destination: Path) -> None:
    for paper in papers:
        for image in paper["media"]:
            source = ROOT / "content" / image["path"]
            target = destination / image["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def write_versioned_index(destination: Path, papers: list[dict]) -> None:
    digest = hashlib.sha256()
    digest.update(json.dumps(papers, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    for source in (ROOT / "index.html", ROOT / "assets" / "styles.css", ROOT / "assets" / "app.js"):
        digest.update(source.read_bytes())
    version = digest.hexdigest()[:12]
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for asset in ("styles.css", "papers.js", "app.js"):
        html = html.replace(f'assets/{asset}"', f'assets/{asset}?v={version}"')
    destination.write_text(html, encoding="utf-8")


def build(papers: list[dict], *, public: bool = False) -> Path:
    output_dir = PUBLIC_DIST_DIR if public else DIST_DIR
    if output_dir.exists():
        shutil.rmtree(output_dir)
    (output_dir / "assets").mkdir(parents=True)
    (output_dir / "notes").mkdir(parents=True)
    for filename in ("404.html", ".nojekyll"):
        shutil.copy2(ROOT / filename, output_dir / filename)
    write_versioned_index(output_dir / "index.html", papers)
    for filename in ("styles.css", "app.js"):
        shutil.copy2(ROOT / "assets" / filename, output_dir / "assets" / filename)
    for paper in papers:
        shutil.copy2(ROOT / paper["source_path"], output_dir / "notes" / paper["source_file"])
    if public:
        copy_selected_media(papers, output_dir)
    elif MEDIA_DIR.exists():
        shutil.copytree(MEDIA_DIR, output_dir / "media")
    write_data(output_dir / "assets" / "papers.js", papers, "public" if public else "private")
    return output_dir


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="仅解析笔记，不创建 dist")
    parser.add_argument(
        "--public", action="store_true",
        help="只构建 sharing: public 的笔记，并写入 dist-public",
    )
    parser.add_argument(
        "--check-public-repo", action="store_true",
        help="确认仓库中不存在 sharing: private 的已跟踪笔记",
    )
    args = parser.parse_args()
    try:
        if args.check_public_repo:
            tracked_private = subprocess.run(
                ["git", "ls-files", "--", "content/private"],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.splitlines()
            if tracked_private:
                raise ContentError(
                    "公开仓库不能跟踪 content/private 中的文件：" + ", ".join(tracked_private)
                )
            public_papers = load_papers(include_private=False)
            print(f"公开仓库校验通过：content/papers 中 {len(public_papers)} 篇记录均可公开")
            return 0
        papers = load_papers(include_private=not args.public)
        if not args.check:
            output_dir = build(papers, public=args.public)
    except ContentError as exc:
        print(f"无法构建站点：\n{exc}", file=sys.stderr)
        return 1
    scope = "公开" if args.public else "本地完整"
    if args.check:
        print(f"已解析（{scope}模式）：{len(papers)} 篇阅读记录")
    else:
        print(f"构建完成（{scope}模式）：{len(papers)} 篇阅读记录 → {output_dir.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
