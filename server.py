#!/usr/bin/env python3
"""Local static server for the pet MBTI web app."""

from __future__ import annotations

import argparse
import functools
import json
import socket
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/config.json":
            host, port = self.server.server_address
            lan_ip = local_ip()
            site_url = f"http://{lan_ip}:{port}"
            if lan_ip.startswith("127.") or host in ("127.0.0.1", "localhost"):
                site_url = ""
            body = json.dumps({"siteUrl": site_url}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def local_ip() -> str:
    candidates: list[str] = []
    for interface in ("en0", "en1"):
        try:
            output = subprocess.check_output(
                ["ipconfig", "getifaddr", interface],
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=1,
            ).strip()
            if output:
                candidates.append(output)
        except (OSError, subprocess.SubprocessError):
            pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            candidates.append(sock.getsockname()[0])
    except OSError:
        pass

    for candidate in candidates:
        if candidate.startswith("192.168."):
            return candidate
    return candidates[0] if candidates else "127.0.0.1"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Petsona MBTI local app.")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host, default: 0.0.0.0")
    parser.add_argument("--port", default=8000, type=int, help="Bind port, default: 8000")
    args = parser.parse_args()

    handler = functools.partial(AppHandler, directory=str(PUBLIC_DIR))
    server = ThreadingHTTPServer((args.host, args.port), handler)

    lan_ip = local_ip()
    print("Petsona MBTI is running")
    print(f"  Local:   http://127.0.0.1:{args.port}")
    print(f"  LAN:     http://{lan_ip}:{args.port}")
    if args.host != "192.168.1.1":
        print("  Note: this Mac is not currently using 192.168.1.1; binding 0.0.0.0 exposes the app on its real LAN IP.")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
