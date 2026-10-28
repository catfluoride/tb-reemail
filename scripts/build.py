#!/usr/bin/env python3
"""Test and build a reproducible XPI using only Python's standard library."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = (
    "manifest.json", "background.js", "api/schema.json",
    "api/implementation.js", "README.md", "LICENSE",
)


def main():
    for script in ("background.js", "api/implementation.js"):
        subprocess.run(["node", "--check", script], cwd=ROOT, check=True)
    for test in ("tests/test.cjs", "tests/quick.cjs"):
        subprocess.run(["node", test], cwd=ROOT, check=True)
    manifest = json.loads((ROOT / "manifest.json").read_text())
    version = manifest["version"]
    if not version or any(c not in "0123456789." for c in version):
        raise ValueError("Expected a numeric extension version")
    out = ROOT / "dist" / f"tb-reemail-{version}.xpi"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, (ROOT / name).read_bytes())
    with zipfile.ZipFile(out) as archive:
        assert archive.testzip() is None, "Corrupt XPI"
        assert set(archive.namelist()) == set(FILES), "Unexpected package contents"
        for name in FILES:
            assert archive.read(name) == (ROOT / name).read_bytes(), f"Stale {name}"
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    out.with_suffix(".xpi.sha256").write_text(f"{digest}  {out.name}\n")
    print(f"Built and verified {out.relative_to(ROOT)}\nSHA256 {digest}")


if __name__ == "__main__":
    main()
