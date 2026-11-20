#!/usr/bin/env bash
# Publish the essay to GitHub Pages: create a public repo (if missing), push main, enable Pages from main /.
# Run ONLY after the owner has read the draft and said OK (notes/for-owner.md).
# Needs ~/work/secrets/github (fine-grained token: Administration, Contents, Pages read/write on own repos)
# and ~/work/secrets/github-user.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=${REPO:-proving-par}
USER_=$(cat ~/work/secrets/github-user)
export GH_TOKEN=$(cat ~/work/secrets/github)
api() { curl -fsS -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$@"; }

[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes; commit first" >&2; exit 1; }
source ~/.nvm/nvm.sh >/dev/null && node --test test/ >/dev/null || { echo "tests fail" >&2; exit 1; }

if ! api "https://api.github.com/repos/$USER_/$REPO" >/dev/null 2>&1; then
  api -X POST https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"description\":\"How do you know 7 is the best? An interactive essay on proving a puzzle's minimum.\",\"homepage\":\"https://$USER_.github.io/$REPO/\",\"has_issues\":true,\"has_wiki\":false}" >/dev/null
  echo "created $USER_/$REPO"
fi
# push without storing the token in the git config
git -c credential.helper= -c "http.extraHeader=Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)" \
  push "https://github.com/$USER_/$REPO.git" HEAD:main
api -X POST "https://api.github.com/repos/$USER_/$REPO/pages" -d '{"source":{"branch":"main","path":"/"}}' >/dev/null 2>&1 \
  || echo "(pages already enabled or needs a moment)"
echo "https://$USER_.github.io/$REPO/"
