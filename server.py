#!/usr/bin/env python3
"""Local static server for the pet MBTI web app."""

from __future__ import annotations

import argparse
import base64
import functools
import json
import os
import socket
import subprocess
import urllib.error
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
MAX_IMAGE_BYTES = 12 * 1024 * 1024


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

    def do_POST(self) -> None:
        if self.path == "/api/anime-pet":
            self.handle_anime_pet()
            return
        self.send_error(404)

    def handle_anime_pet(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            self.write_json({"error": "OPENAI_API_KEY is not configured"}, status=503)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_IMAGE_BYTES * 2:
                self.write_json({"error": "Image payload is too large"}, status=413)
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            image_bytes, media_type = parse_data_url(payload.get("image", ""))
            if len(image_bytes) > MAX_IMAGE_BYTES:
                self.write_json({"error": "Image is too large"}, status=413)
                return

            prompt = build_anime_prompt(payload)
            result = create_openai_image_edit(api_key, image_bytes, media_type, prompt)
            self.write_json({"image": result})
        except ValueError as error:
            self.write_json({"error": str(error)}, status=400)
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            print(f"OpenAI image API error {error.code}: {body}")
            self.write_json({"error": "Image generation failed"}, status=502)
        except Exception as error:
            print(f"Anime pet generation failed: {error}")
            self.write_json({"error": "Image generation failed"}, status=500)

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


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


def parse_data_url(data_url: str) -> tuple[bytes, str]:
    if not data_url.startswith("data:image/") or ";base64," not in data_url:
        raise ValueError("Invalid image data")
    header, encoded = data_url.split(",", 1)
    media_type = header.removeprefix("data:").split(";", 1)[0]
    if media_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError("Unsupported image type")
    try:
        return base64.b64decode(encoded, validate=True), media_type
    except ValueError as error:
        raise ValueError("Invalid image encoding") from error


def build_anime_prompt(payload: dict) -> str:
    mbti = str(payload.get("mbti", "PET")).strip()[:12]
    name = str(payload.get("name", "宠物人格")).strip()[:32]
    return (
        "Transform the uploaded pet photo into a charming high-quality anime mascot portrait. "
        "Preserve the real pet identity from the reference photo: species, face shape, ear shape, eye placement, "
        "coat colors, unique markings, expression, and recognizable proportions. "
        "Use a clean Japanese anime / modern mobile game mascot style, soft cel shading, crisp expressive line art, "
        "large glossy eyes, cute but not childish, polished sticker-like rendering. "
        "Create only the pet character on a simple warm light background. "
        "Do not include typography, logos, MBTI letters, captions, QR codes, frames, posters, UI elements, or extra animals. "
        f"The final poster will label this pet as MBTI {mbti}, {name}; let the expression feel compatible with that personality."
    )


def create_openai_image_edit(api_key: str, image_bytes: bytes, media_type: str, prompt: str) -> str:
    boundary = f"----petsona-{uuid.uuid4().hex}"
    body = build_multipart_body(
        boundary,
        fields={
            "model": "gpt-image-1",
            "prompt": prompt,
            "size": "1024x1024",
            "quality": "medium",
            "output_format": "png",
        },
        files={
            "image": (
                "pet-reference.png" if media_type == "image/png" else "pet-reference.jpg",
                media_type,
                image_bytes,
            )
        },
    )
    request = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.loads(response.read().decode("utf-8"))
    try:
        return payload["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError) as error:
        raise ValueError("Image API did not return image data") from error


def build_multipart_body(
    boundary: str,
    fields: dict[str, str],
    files: dict[str, tuple[str, str, bytes]],
) -> bytes:
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")
    for name, (filename, media_type, data) in files.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(
            (
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {media_type}\r\n\r\n"
            ).encode("utf-8")
        )
        chunks.append(data)
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks)


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
