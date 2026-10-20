#!/usr/bin/env bash
set -euo pipefail
command -v gh >/dev/null || { echo 'Install GitHub CLI (gh) first'; exit 1; }
gh auth status >/dev/null
gh auth setup-git
repo=catfluoride/tb-reemail
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
git clone "https://github.com/$repo.git" "$workdir/repo"
cd "$workdir/repo"
cp -a "$(dirname "$(readlink -f "$0")")"/. .
rm -f publish.sh
node --check background.js
node --check api/implementation.js
node tests/test.cjs
node tests/quick.cjs
(cd dist && sha256sum -c tb-reemail-0.5.0.xpi.sha256)
git add -A
git diff --cached --quiet || git commit -m 'Release tb-reemail v0.5.0 with direct email reminder shortcut'
git push origin HEAD:main
if gh release view v0.5.0 -R "$repo" >/dev/null 2>&1; then
  gh release upload v0.5.0 --clobber dist/tb-reemail-0.5.0.xpi dist/tb-reemail-0.5.0.xpi.sha256 -R "$repo"
else
  gh release create v0.5.0 dist/tb-reemail-0.5.0.xpi dist/tb-reemail-0.5.0.xpi.sha256 -R "$repo" --target main --title 'v0.5.0 (experimental)' --prerelease --notes-file RELEASE_NOTES.md
fi
