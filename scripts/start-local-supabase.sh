#!/bin/zsh
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
source /Users/botmaster/.codex/skills/local-supabase-coordinator/scripts/runtime-env.sh
exec /opt/homebrew/bin/python3 "$project_root/scripts/local-supabase-session.py" "$@"
