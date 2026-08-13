#!/usr/bin/env python3
"""Build, watch, serve, and live-reload the local Paper Notes site."""

from __future__ import annotations

import argparse
import functools
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WATCH_TARGETS = (
    ROOT / "assets",
    ROOT / "content",
    ROOT / "index.html",
    ROOT / "scripts" / "build_site.py",
)
WATCH_SUFFIXES = {".css", ".html", ".jpeg", ".jpg", ".js", ".md", ".png", ".py", ".webp"}
RELOAD_SCRIPT = b"""
<script>
(() => {
  let currentVersion = null;
  const check = async () => {
    try {
      const response = await fetch('/__paper_notes_version?' + Date.now(), {cache: 'no-store'});
      const nextVersion = await response.text();
      if (currentVersion === null) currentVersion = nextVersion;
      else if (nextVersion !== currentVersion) location.reload();
    } catch (_) {}
  };
  check();
  setInterval(check, 900);
})();
</script>
"""


class PreviewState:
    version = str(time.time_ns())
    build_lock = threading.Lock()


def source_signature() -> tuple[tuple[str, int, int], ...]:
    files: list[Path] = []
    for target in WATCH_TARGETS:
        if target.is_file():
            files.append(target)
        elif target.is_dir():
            files.extend(path for path in target.rglob("*") if path.is_file())
    signature = []
    for path in files:
        if path.suffix.lower() not in WATCH_SUFFIXES:
            continue
        stat = path.stat()
        signature.append((str(path.relative_to(ROOT)), stat.st_mtime_ns, stat.st_size))
    return tuple(sorted(signature))


def build_site(public: bool) -> None:
    command = [sys.executable, str(ROOT / "scripts" / "build_site.py")]
    if public:
        command.append("--public")
    with PreviewState.build_lock:
        subprocess.run(command, cwd=ROOT, check=True)
        PreviewState.version = str(time.time_ns())


def watch_sources(public: bool, stop_event: threading.Event) -> None:
    previous = source_signature()
    while not stop_event.wait(0.8):
        current = source_signature()
        if current == previous:
            continue
        previous = current
        print("\n检测到修改，正在重新构建…", flush=True)
        try:
            build_site(public)
            print("构建完成，浏览器将自动刷新。", flush=True)
        except subprocess.CalledProcessError:
            print("构建失败：请根据上方提示修正 Markdown。", flush=True)


class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, message_format: str, *args: object) -> None:
        if self.path.startswith("/__paper_notes_version"):
            return
        super().log_message(message_format, *args)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        url_path = urllib.parse.urlsplit(self.path).path
        if url_path == "/__paper_notes_version":
            payload = PreviewState.version.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        local_path = Path(self.translate_path(url_path))
        if local_path.is_dir():
            local_path /= "index.html"
        if local_path.is_file() and local_path.suffix.lower() == ".html":
            payload = local_path.read_bytes()
            payload = payload.replace(b"</body>", RELOAD_SCRIPT + b"</body>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()


def main() -> int:
    parser = argparse.ArgumentParser(description="本地预览 Paper Notes，并在保存后自动重建。")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--public", action="store_true", help="只预览已公开笔记")
    parser.add_argument("--open", action="store_true", help="自动打开浏览器")
    args = parser.parse_args()

    try:
        build_site(args.public)
    except subprocess.CalledProcessError as exc:
        return exc.returncode

    output_dir = ROOT / ("dist-public" if args.public else "dist")
    handler = functools.partial(PreviewHandler, directory=str(output_dir))
    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        print(f"无法启动预览：{exc}", file=sys.stderr)
        return 1

    stop_event = threading.Event()
    watcher = threading.Thread(target=watch_sources, args=(args.public, stop_event), daemon=True)
    watcher.start()
    url = f"http://{args.host}:{args.port}"
    print(f"本地预览已启动：{url}", flush=True)
    print("保存文件后会自动重建与刷新；按 Control+C 停止。", flush=True)
    if args.open:
        threading.Timer(0.35, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n本地预览已停止。")
    finally:
        stop_event.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
