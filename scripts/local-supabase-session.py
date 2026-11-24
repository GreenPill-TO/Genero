#!/usr/bin/env python3
"""Operate only this session's admitted, independent local Supabase project."""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tomllib

SESSIONS = Path('/Volumes/MiniBot/colima/sessions')
SLOTS = Path('/Users/botmaster/.codex/skills/local-supabase-coordinator/scripts/slots.py')
RUNTIME = '/Volumes/MiniBot/colima/runtime'
SOCKET = f'unix://{RUNTIME}/codex-supabase/docker.sock'
PORT_FIELDS = {
    ('db', 'shadow_port'): 0, ('api', 'port'): 1, ('db', 'port'): 2,
    ('studio', 'port'): 3, ('inbucket', 'port'): 4,
    ('inbucket', 'smtp_port'): 5, ('inbucket', 'pop3_port'): 6,
    ('analytics', 'port'): 7, ('edge_runtime', 'inspector_port'): 8,
    ('db', 'pooler', 'port'): 9,
}


def verify_local_cli_state(checkout, project):
    # Fresh `start` itself creates these local files. Never accept remote target
    # metadata, another project's runtime secrets or saved database branches.
    secret_dir = f'start-secrets/supabase_edge_runtime_{project}'
    allowed = {
        '.temp': ({'cli-latest', f'{secret_dir}/env/docker.env'},
                  {'start-secrets', secret_dir, f'{secret_dir}/env'}),
        '.branches': ({'_current_branch'}, set()),
    }
    for name, (files, directories) in allowed.items():
        root = checkout / 'supabase' / name
        if root.is_symlink() or (root.exists() and not root.is_dir()):
            raise ValueError('Independent inputs must not contain hosted linkage or unknown CLI state.')
        if not root.exists():
            continue
        for entry in root.rglob('*'):
            relative = entry.relative_to(root).as_posix()
            permitted = relative in (directories if entry.is_dir() else files)
            if entry.is_symlink() or not permitted or not (entry.is_file() or entry.is_dir()):
                raise ValueError('Independent inputs must not contain hosted linkage or unknown CLI state.')
            if relative.endswith('/env/docker.env'):
                info = entry.stat()
                if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600:
                    raise ValueError('CLI-generated local runtime secrets must remain private.')
        marker = root / '_current_branch'
        if name == '.branches' and marker.exists() and marker.read_text().strip() != 'main':
            raise ValueError('Independent inputs must not contain saved database branch state.')


def context(env):
    if (env.get('COLIMA_HOME') != RUNTIME or env.get('DOCKER_HOST') != SOCKET
            or env.get('COLIMA_PROFILE') != 'codex-supabase' or env.get('DOCKER_CONTEXT')):
        raise ValueError('Source the canonical runtime-env.sh; no Docker context fallback is permitted.')
    session = env.get('SLOT_SESSION', '')
    if not re.fullmatch(r'(codex|claude):[A-Za-z0-9_.-]+', session):
        raise ValueError('SLOT_SESSION must be the actual stable Codex/Claude session identity.')
    if not all(env.get(k) for k in ('SLOT_DIR', 'SLOT_SCOPE', 'SLOT_TOKEN_FILE')):
        raise ValueError('Set SLOT_DIR, SLOT_SCOPE and SLOT_TOKEN_FILE before local runtime use.')
    agent, identity = session.split(':', 1)
    checkout = Path(env['SLOT_DIR']).resolve(strict=True)
    expected = (SESSIONS / agent / identity).resolve()
    if checkout != expected:
        raise ValueError('SLOT_DIR must be this identity\'s independent Colima session directory.')
    token_path = Path(env['SLOT_TOKEN_FILE'])
    if token_path.is_symlink() or not token_path.is_file():
        raise ValueError('SLOT_TOKEN_FILE must be a private regular file.')
    info = token_path.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('SLOT_TOKEN_FILE must be owned by this user with mode 0600.')
    token = token_path.read_text().strip()
    if len(token) < 24:
        raise ValueError('Saved ownership token is invalid.')
    config = tomllib.loads((checkout / 'supabase/config.toml').read_text())
    project = config.get('project_id', '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', project) or project.lower() == 'genero':
        raise ValueError('Independent inputs need a unique session project_id.')
    verify_local_cli_state(checkout, project)
    return {'session': session, 'checkout': checkout, 'token': token,
            'scope': env['SLOT_SCOPE'], 'project': project, 'config': config}


def slot(action, ctx, runner):
    # Do not log this command: the supported ledger CLI uses a private token.
    result = runner([sys.executable, str(SLOTS), action, '--session', ctx['session'],
                     '--token', ctx['token']], capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise ValueError(f'Local Supabase {action} failed; use the saved identity with slots.py for details.')
    return json.loads(result.stdout)


def verify_lease(state, ctx):
    if state.get('schema') != 2:
        raise ValueError('Legacy/unknown admission schema; do not start a stack.')
    records = [r for r in state.get('active_leases', [])
               if r.get('source_thread_id') == ctx['session']]
    if len(records) != 1:
        raise ValueError('This session has no exact active lease; a queue entry is not permission.')
    record = records[0]
    expected = {'project_id': ctx['project'], 'checkout': str(ctx['checkout']),
                'scope': ctx['scope'], 'kind': 'supabase', 'status': 'active'}
    if any(record.get(k) != v for k, v in expected.items()):
        raise ValueError('Active lease does not match this project, checkout, scope and runtime kind.')
    match = re.fullmatch(r'(\d+)-(\d+)', record.get('port_family', ''))
    if not match or int(match[2]) != int(match[1]) + 9:
        raise ValueError('Active lease has an invalid complete port family.')
    start = int(match[1])
    if 'inbucket' in ctx['config'] and 'local_smtp' in ctx['config']:
        raise ValueError('Configure one local email service section, not both aliases.')
    mail_section = 'local_smtp' if 'local_smtp' in ctx['config'] else 'inbucket'
    fields = {((mail_section,) + keys[1:] if keys[0] == 'inbucket' else keys): offset
              for keys, offset in PORT_FIELDS.items()}
    for keys, offset in fields.items():
        value = ctx['config']
        for key in keys:
            value = value.get(key, {}) if isinstance(value, dict) else None
        if value != start + offset:
            raise ValueError('Configure every local/optional port explicitly within the leased family.')
    assigned = []
    def collect(data):
        for key, value in data.items():
            if isinstance(value, dict):
                collect(value)
            elif key == 'port' or key.endswith('_port'):
                assigned.append(value)
    collect(ctx['config'])
    if len(assigned) != len(PORT_FIELDS) or len(set(assigned)) != len(PORT_FIELDS):
        raise ValueError('Unexpected or duplicate local port assignment.')
    return start


def execute(action, env, runner=subprocess.run):
    if action not in {'check', 'start', 'stop'}:
        raise ValueError('Only check, start and project-only stop are supported.')
    ctx = context(env)
    start = verify_lease(slot('check', ctx, runner), ctx)
    if action == 'check':
        return {'project_id': ctx['project'], 'api_port': start + 1, 'status': 'active'}
    command = ['supabase', '--workdir', str(ctx['checkout'])] + (
        ['start', '-x', 'storage-api,imgproxy,logflare,vector,studio']
        if action == 'start' else ['stop', '--project-id', ctx['project']])
    result = runner(command, cwd=ctx['checkout'], env=env)
    if result.returncode:
        raise ValueError(f'Project-only {action} failed. Preserve ownership and diagnose this project.')
    if action == 'stop':
        # The ledger independently requires fresh zero-container/listener proof.
        slot('release', ctx, runner)
    return {'project_id': ctx['project'], 'status': 'started' if action == 'start' else 'released'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', nargs='?', default='start', choices=['check', 'start', 'stop'])
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args.action, dict(os.environ))))
    except (ValueError, OSError, KeyError, subprocess.SubprocessError):
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, ValueError) else 'Local session preflight failed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
