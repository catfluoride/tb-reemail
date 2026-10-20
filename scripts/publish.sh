#!/usr/bin/env bash
# Publish the prepared project as a PUBLIC GitHub repository and an experimental release.
# Requires git and authenticated gh CLI. Does NOT overwrite an existing repository.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO="catfluoride/tb-reemail"
VERSION="v0.4.0"
ASSET="dist/caldav-email-valarm-0.4.0.xpi"
command -v git >/dev/null || { echo 'Missing git' >&2; exit 1; }
command -v gh >/dev/null || { echo 'Missing GitHub CLI: install github-cli' >&2; exit 1; }
gh auth status >/dev/null || { echo 'Log in first: gh auth login' >&2; exit 1; }
LOGIN="$(gh api user --jq .login)"
if [[ "$LOGIN" != "catfluoride" ]]; then
  echo "Authenticated as $LOGIN; expected catfluoride. Aborting." >&2
  exit 1
fi
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository $REPO already exists; refusing to overwrite anything." >&2
  exit 1
fi
if [[ -d .git ]]; then
  echo 'Local .git already exists; refusing to modify existing history.' >&2
  exit 1
fi
if command -v node >/dev/null; then
  node --check background.js
  node --check api/implementation.js
  node tests/test.cjs
else
  echo "Node.js not installed; skipping optional local JavaScript tests."
fi
(cd dist && sha256sum -c caldav-email-valarm-0.4.0.xpi.sha256)
git init -b main
git add .
git commit -m 'Initial public source and v0.4.0 experimental XPI'
gh repo create "$REPO" --public --description 'CalDAV EMAIL VALARM editor for Thunderbird and Betterbird (experimental)' --source=. --remote=origin --push
if [[ "$(gh repo view "$REPO" --json isPrivate --jq .isPrivate)" != 'false' ]]; then
  echo 'ERROR: repository visibility not confirmed public; refusing release.' >&2
  exit 1
fi
git tag -a "$VERSION" -m 'Experimental v0.4.0 developer release'
git push origin "$VERSION"
gh release create "$VERSION" "$ASSET" "$ASSET.sha256"   --repo "$REPO" --verify-tag --prerelease   --title "$VERSION (experimental)" --notes-file RELEASE_NOTES.md
printf '\nRepository: https://github.com/%s\nRelease: https://github.com/%s/releases/tag/%s\n' "$REPO" "$REPO" "$VERSION"
