#!/usr/bin/env bash
# Publish the checked-out commit and a freshly tested package. Never overwrite a release.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v gh >/dev/null || { echo 'Install the GitHub CLI (gh) first.' >&2; exit 1; }
gh auth status >/dev/null
repo=catfluoride/tb-reemail
version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
tag="v$version"
asset="dist/tb-reemail-$version.xpi"
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || {
  echo 'Commit or remove local changes before publishing.' >&2; exit 1;
}
python3 scripts/build.py
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "Release $tag already exists; refusing to overwrite it." >&2; exit 1
fi
commit=$(git rev-parse HEAD)
# Confirm this exact commit is reachable in the intended repository.
gh api "repos/$repo/commits/$commit" >/dev/null
gh release create "$tag" "$asset" "$asset.sha256" --repo "$repo" \
  --target "$commit" --prerelease --title "$tag (experimental)" --notes-file RELEASE_NOTES.md
