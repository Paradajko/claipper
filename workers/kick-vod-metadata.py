import json
import re
import sys
from urllib.parse import quote

from curl_cffi import requests


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"[A-Za-z0-9_-]+", sys.argv[1]):
        raise SystemExit("Expected one Kick channel slug.")

    slug = quote(sys.argv[1], safe="")
    response = requests.get(
        f"https://kick.com/api/v2/channels/{slug}/videos",
        impersonate="chrome",
        headers={"Accept": "application/json"},
        timeout=30,
    )
    response.raise_for_status()
    if len(response.content) > 10 * 1024 * 1024:
        raise RuntimeError("Kick VOD metadata response is too large.")

    payload = response.json()
    if not isinstance(payload, list):
        raise RuntimeError("Kick returned invalid VOD metadata.")
    json.dump(payload, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
