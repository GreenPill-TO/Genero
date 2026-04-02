#!/bin/zsh

set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
project_name="Genero"
auth_container="supabase_auth_${project_name}"
network_name="supabase_network_${project_name}"
default_excludes=(-x storage-api,imgproxy,logflare,vector,studio)

if docker context ls --format '{{.Name}}' | grep -qx 'colima-varrun'; then
    docker context use colima-varrun >/dev/null
fi

if [ "$#" -eq 0 ]; then
    supabase_args=("${default_excludes[@]}")
else
    supabase_args=("$@")
fi

(
    cd "$project_root"
    supabase start "${supabase_args[@]}"
)

if ! docker inspect "$auth_container" >/dev/null 2>&1; then
    echo "Auth container $auth_container was not started; skipping mailer host patch." >&2
    exit 0
fi

tmp_env_json="$(mktemp)"
tmp_recreate_script="$(mktemp)"

cleanup() {
    rm -f "$tmp_env_json" "$tmp_recreate_script"
}
trap cleanup EXIT

docker inspect "$auth_container" --format '{{json .Config.Env}}' > "$tmp_env_json"

python3 - <<'PY' "$tmp_env_json" "$tmp_recreate_script" "$auth_container" "$network_name"
import json
import shlex
import sys

env_json_path, script_path, auth_container, network_name = sys.argv[1:5]

with open(env_json_path) as env_file:
    envs = json.load(env_file)

envs = [env for env in envs if not env.startswith("GOTRUE_MAILER_EXTERNAL_HOSTS=")]
envs.append("GOTRUE_MAILER_EXTERNAL_HOSTS=localhost,127.0.0.1")

parts = [
    "docker",
    "run",
    "-d",
    "--name",
    auth_container,
    "--network",
    network_name,
    "--network-alias",
    "auth",
    "--network-alias",
    auth_container,
    "--restart",
    "unless-stopped",
    "--user",
    "supabase",
    "--label",
    "com.docker.compose.project=Genero",
    "--label",
    "com.supabase.cli.project=Genero",
]

for env in envs:
    parts.extend(["--env", env])

parts.extend(["public.ecr.aws/supabase/gotrue:v2.188.1", "auth"])

with open(script_path, "w", encoding="utf-8") as script_file:
    script_file.write("#!/bin/zsh\n")
    script_file.write("set -euo pipefail\n")
    script_file.write(f"docker rm -f {shlex.quote(auth_container)} >/dev/null 2>&1 || true\n")
    script_file.write(" ".join(shlex.quote(part) for part in parts))
    script_file.write("\n")
PY

chmod +x "$tmp_recreate_script"
"$tmp_recreate_script" >/dev/null

docker inspect "$auth_container" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^GOTRUE_MAILER_EXTERNAL_HOSTS='
