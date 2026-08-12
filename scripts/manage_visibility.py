#!/usr/bin/env python3
"""Run a local-only Paper Notes visibility manager."""

from __future__ import annotations

import argparse
import json
import secrets
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from build_site import ContentError, PRIVATE_CONTENT_DIR, CONTENT_DIR, parse_note


ROOT = Path(__file__).resolve().parents[1]


def note_paths() -> list[Path]:
    paths = list(CONTENT_DIR.glob("*.md"))
    if PRIVATE_CONTENT_DIR.exists():
        paths.extend(PRIVATE_CONTENT_DIR.glob("*.md"))
    return sorted(paths)


def load_notes() -> list[dict]:
    notes = []
    errors = []
    for path in note_paths():
        try:
            note = parse_note(path)
            notes.append({
                "slug": note["slug"],
                "title": note["title"],
                "status": note["status"],
                "read_date": note["read_date"],
                "tags": note["tags"],
                "sharing": note["sharing"],
                "source_path": note["source_path"],
            })
        except ContentError as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    if errors:
        raise ContentError("\n".join(errors))
    return sorted(notes, key=lambda item: (item["sharing"] != "public", item["title"]))


def replace_field(text: str, key: str, value: str) -> str:
    lines = text.splitlines()
    replacement = f'{key}: "{value}"'
    for index, line in enumerate(lines):
        if line.startswith(f"{key}:"):
            lines[index] = replacement
            return "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    raise ContentError(f"笔记缺少字段：{key}")


def set_visibility(note: dict, sharing: str) -> None:
    if sharing not in {"public", "private"}:
        raise ContentError("可见性只能是 public 或 private")
    if note["sharing"] == sharing:
        return

    source = ROOT / note["source_path"]
    destination_dir = CONTENT_DIR if sharing == "public" else PRIVATE_CONTENT_DIR
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / source.name
    if destination.exists() and destination != source:
        raise ContentError(f"目标文件已存在：{destination.relative_to(ROOT)}")

    original = source.read_text(encoding="utf-8")
    changed = replace_field(original, "sharing", sharing)
    created_at = next(
        line.split(":", 1)[1].strip().strip('"')
        for line in original.splitlines() if line.startswith("created_at:")
    )
    previous_updated_at = next(
        line.split(":", 1)[1].strip().strip('"')
        for line in original.splitlines() if line.startswith("updated_at:")
    )
    now = datetime.now().astimezone()
    created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    previous_updated = datetime.fromisoformat(previous_updated_at.replace("Z", "+00:00"))
    updated = max(now, created, previous_updated).isoformat(timespec="seconds")
    changed = replace_field(changed, "updated_at", updated)

    if destination == source:
        source.write_text(changed, encoding="utf-8")
        try:
            parse_note(source)
        except Exception:
            source.write_text(original, encoding="utf-8")
            raise
        return

    destination.write_text(changed, encoding="utf-8")
    try:
        parse_note(destination)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    source.unlink()


def apply_visibility(scope: str, identifier: str, sharing: str) -> int:
    notes = load_notes()
    if scope == "note":
        selected = [note for note in notes if note["slug"] == identifier]
    elif scope == "tag":
        selected = [note for note in notes if identifier in note["tags"]]
    elif scope == "all":
        selected = notes
    else:
        raise ContentError("未知操作范围")
    if not selected:
        raise ContentError("没有找到匹配的笔记")
    changed = 0
    for note in selected:
        if note["sharing"] != sharing:
            set_visibility(note, sharing)
            changed += 1
    return changed


HTML = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paper Notes · 本地可见性</title><style>
:root{--bg:#eceef5;--card:#fafafd;--ink:#172033;--muted:#68738a;--line:#c7cddd;--accent:#6046d7;--lime:#d7ff62;--hot:#ff6948;font-family:Inter,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:var(--ink);background:var(--bg)}
*{box-sizing:border-box}body{margin:0;background-image:linear-gradient(rgba(96,70,215,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(96,70,215,.05) 1px,transparent 1px);background-size:36px 36px}main{width:min(1080px,calc(100% - 32px));margin:auto;padding:56px 0 90px}h1{margin:8px 0 10px;font-family:"Iowan Old Style","Songti SC",serif;font-size:clamp(2.8rem,7vw,5.5rem);line-height:1}.eyebrow{color:var(--accent);font:800 .7rem ui-monospace;letter-spacing:.15em}.intro{max-width:760px;color:var(--muted);line-height:1.8}.warning{margin:28px 0;padding:16px 18px;border-left:4px solid var(--hot);background:#ffe3de;line-height:1.65}.summary,.tag-panel{margin:24px 0;padding:20px;border:1px solid var(--line);background:rgba(250,250,253,.78)}.summary{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}.counts{font-weight:750}.actions,.tag-actions{display:flex;gap:8px;flex-wrap:wrap}button{padding:8px 12px;border:1px solid var(--line);border-radius:4px;color:var(--ink);background:var(--card);cursor:pointer}button:hover{border-color:var(--accent)}button.public{background:var(--lime);border-color:var(--lime)}button.private{color:var(--muted)}.tag-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px}.tag-row{padding:10px 0;display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid var(--line)}.tag-name{font-size:.85rem}.tag-actions button{padding:5px 8px;font-size:.72rem}.notes{display:grid;gap:12px}.note{padding:20px;display:grid;grid-template-columns:1fr auto;gap:14px;border:1px solid var(--line);background:rgba(250,250,253,.78)}.note h2{margin:0 0 8px;font-family:"Iowan Old Style","Songti SC",serif;font-size:1.4rem}.meta,.tags{color:var(--muted);font-size:.76rem}.tags{margin-top:8px}.badge{display:inline-block;margin-right:8px;padding:2px 7px;color:var(--accent);border:1px solid var(--line);border-radius:99px;font-size:.68rem}.toast{position:fixed;left:50%;bottom:24px;padding:10px 14px;transform:translateX(-50%);background:var(--lime);font-weight:750;opacity:0;transition:.16s}.toast.show{opacity:1}@media(max-width:650px){main{padding-top:34px}.note{grid-template-columns:1fr}.note .actions{justify-content:flex-start}}
</style></head><body><main>
<p class="eyebrow">LOCAL ONLY / VISIBILITY</p><h1>公开什么，留住什么。</h1>
<p class="intro">这里仅修改你电脑上的笔记目录与 <code>sharing</code>。公开笔记位于 <code>content/papers</code>；仅本地笔记位于被 Git 忽略的 <code>content/private</code>。操作后仍需提交并推送，网页才会改变。</p>
<div class="warning">已经公开过的内容即使改为仅本地，仍可能存在于 Git 历史中。敏感资料从一开始就不要公开、提交或推送。</div>
<section class="summary"><div class="counts" id="counts">正在读取…</div><div class="actions"><button class="public" data-scope="all" data-sharing="public">全部公开</button><button class="private" data-scope="all" data-sharing="private">全部仅本地</button></div></section>
<section class="tag-panel"><p class="eyebrow">BULK BY TAG</p><div class="tag-list" id="tags"></div></section>
<section class="notes" id="notes"></section></main><div class="toast" id="toast"></div>
<script>
const token=new URLSearchParams(location.search).get('token');const api=(path,options={})=>fetch(path+'?token='+encodeURIComponent(token),options).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'操作失败');return data});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
async function change(scope,identifier,sharing){if(sharing==='public'&&scope!=='note'&&!confirm('确认把这一组完整笔记设为公开？这一步只修改本地，推送后才会上线。'))return;const result=await api('/api/visibility',{method:'POST',headers:{'Content-Type':'application/json','X-Paper-Notes-Token':token},body:JSON.stringify({scope,identifier,sharing})});toast(result.message);await render()}
function buttons(scope,identifier,current){return `<div class="actions"><button class="public" data-scope="${scope}" data-id="${esc(identifier)}" data-sharing="public" ${current==='public'?'disabled':''}>公开</button><button class="private" data-scope="${scope}" data-id="${esc(identifier)}" data-sharing="private" ${current==='private'?'disabled':''}>仅本地</button></div>`}
async function render(){const state=await api('/api/state');document.querySelector('#counts').textContent=`${state.public_count} 篇公开 · ${state.private_count} 篇仅本地`;
document.querySelector('#tags').innerHTML=state.tags.map(t=>`<div class="tag-row"><span class="tag-name">#${esc(t.name)} · ${t.count}</span><div class="tag-actions"><button data-scope="tag" data-id="${esc(t.name)}" data-sharing="public">全公开</button><button data-scope="tag" data-id="${esc(t.name)}" data-sharing="private">全隐藏</button></div></div>`).join('');
document.querySelector('#notes').innerHTML=state.notes.map(n=>`<article class="note"><div><span class="badge">${n.sharing==='public'?'公开':'仅本地'}</span><span class="meta">${esc(n.status)} · ${esc(n.read_date)}</span><h2>${esc(n.title)}</h2><div class="tags">${n.tags.map(t=>'#'+esc(t)).join(' · ')}</div></div>${buttons('note',n.slug,n.sharing)}</article>`).join('');}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sharing]');if(!b||b.disabled)return;change(b.dataset.scope,b.dataset.id||'',b.dataset.sharing).catch(err=>alert(err.message))});render().catch(err=>alert(err.message));
</script></body></html>'''


def state_payload() -> dict:
    notes = load_notes()
    tag_counts = {}
    for note in notes:
        for tag in note["tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    return {
        "notes": notes,
        "public_count": sum(note["sharing"] == "public" for note in notes),
        "private_count": sum(note["sharing"] == "private" for note in notes),
        "tags": [
            {"name": name, "count": count}
            for name, count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
    }


def handler_factory(token: str):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, payload: dict, status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def authorized(self) -> bool:
            query_token = parse_qs(urlparse(self.path).query).get("token", [""])[0]
            return secrets.compare_digest(query_token, token)

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if not self.authorized():
                self.send_error(403)
                return
            if parsed.path == "/":
                body = HTML.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif parsed.path == "/api/state":
                try:
                    self.send_json(state_payload())
                except Exception as exc:
                    self.send_json({"error": str(exc)}, 400)
            else:
                self.send_error(404)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path != "/api/visibility" or not self.authorized():
                self.send_error(403 if not self.authorized() else 404)
                return
            if not secrets.compare_digest(self.headers.get("X-Paper-Notes-Token", ""), token):
                self.send_json({"error": "本地令牌无效"}, 403)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 8192:
                    raise ContentError("请求过大")
                payload = json.loads(self.rfile.read(length))
                changed = apply_visibility(
                    str(payload.get("scope", "")),
                    str(payload.get("identifier", "")),
                    str(payload.get("sharing", "")),
                )
                self.send_json({"message": f"已更新 {changed} 篇笔记"})
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)

        def log_message(self, format: str, *args) -> None:
            return

    return Handler


def main() -> int:
    parser = argparse.ArgumentParser(description="打开 Paper Notes 本地可见性管理页")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true", help="不要自动打开浏览器")
    args = parser.parse_args()
    token = secrets.token_urlsafe(18)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_factory(token))
    url = f"http://127.0.0.1:{args.port}/?token={token}"
    print(f"Paper Notes 本地可见性管理：{url}")
    print("按 Control-C 关闭。")
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已关闭本地管理页。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
