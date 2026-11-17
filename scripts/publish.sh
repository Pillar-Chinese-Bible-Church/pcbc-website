#!/usr/bin/env bash
# Called only after this exact revision passes the validation job.
set -euo pipefail
[[ "${REVISION:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'Enter a full commit SHA' >&2; exit 1; }
test "$(git rev-parse HEAD)" = "$REVISION"
git merge-base --is-ancestor "$REVISION" origin/main
# No force: reject a revision that would discard anything already on live.
git push origin "$REVISION:refs/heads/live"
