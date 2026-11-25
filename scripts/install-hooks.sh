#!/bin/sh
# Installs the repository's git hooks (run by `make hooks`).
set -eu

root=$(git rev-parse --show-toplevel)
hooks=$(git rev-parse --git-path hooks)
mkdir -p "$hooks"
ln -sf "$root/scripts/pre-commit" "$hooks/pre-commit"
echo "Installed the pre-commit hook: $hooks/pre-commit -> scripts/pre-commit"
