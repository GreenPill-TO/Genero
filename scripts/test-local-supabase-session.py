"""Stub-only admission tests: no Docker, Supabase or ledger mutation."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('local_session', Path(__file__).with_name('local-supabase-session.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class LocalSessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/Volumes/MiniBot/scratch')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.checkout = self.base / 'sessions/codex/test-session'
        (self.checkout / 'supabase').mkdir(parents=True)
        self.token = self.base / 'private-token'
        self.token.write_text('test-only-token-with-more-than-24-characters')
        self.token.chmod(0o600)
        self.config = {'project_id': 'tcoin-test-session', 'api': {'port': 62321},
                       'db': {'port': 62322, 'shadow_port': 62320, 'pooler': {'port': 62329}},
                       'studio': {'port': 62323},
                       'inbucket': {'port': 62324, 'smtp_port': 62325, 'pop3_port': 62326},
                       'analytics': {'port': 62327}, 'edge_runtime': {'inspector_port': 62328}}
        # The TOML parser is isolated below; all filesystem/identity checks still run.
        (self.checkout / 'supabase/config.toml').write_text('project_id="tcoin-test-session"')
        self.env = {'COLIMA_HOME': helper.RUNTIME, 'DOCKER_HOST': helper.SOCKET,
                    'COLIMA_PROFILE': 'codex-supabase', 'SLOT_SESSION': 'codex:test-session',
                    'SLOT_DIR': str(self.checkout), 'SLOT_SCOPE': 'Fresh local auth validation',
                    'SLOT_TOKEN_FILE': str(self.token)}
        self.record = {'source_thread_id': 'codex:test-session', 'project_id': 'tcoin-test-session',
                       'checkout': str(self.checkout), 'scope': self.env['SLOT_SCOPE'],
                       'kind': 'supabase', 'status': 'active', 'port_family': '62320-62329'}
        self.state = {'schema': 2, 'active_leases': [self.record], 'queued_requests': []}
        self.calls = []
        self.addCleanup(patch.stopall)
        patch.object(helper, 'SESSIONS', self.base / 'sessions').start()
        patch.object(helper.tomllib, 'loads', side_effect=lambda _: copy.deepcopy(self.config)).start()

    def runner(self, args, **kwargs):
        self.calls.append((args, kwargs))
        return subprocess.CompletedProcess(args, 0, json.dumps(self.state), '')

    def execute(self, action='start'):
        return helper.execute(action, self.env, self.runner)

    def test_start_uses_only_owned_checkout_and_no_auth_recreation(self):
        self.assertEqual(self.execute()['status'], 'started')
        self.assertEqual(self.calls[0][0][2], 'check')
        self.assertEqual(self.calls[1][0], ['supabase', 'start', '-x', 'storage-api,imgproxy,logflare,vector,studio'])
        self.assertEqual(self.calls[1][1]['cwd'], self.checkout)
        self.assertEqual(len(self.calls), 2)

    def test_stop_is_project_specific_then_release(self):
        self.assertEqual(self.execute('stop')['status'], 'released')
        self.assertEqual(self.calls[1][0], ['supabase', 'stop', '--project-id', self.record['project_id']])
        self.assertEqual(self.calls[2][0][2], 'release')

    def test_check_reports_only_own_public_identity(self):
        result = self.execute('check')
        self.assertEqual(result, {'project_id': 'tcoin-test-session', 'api_port': 62321, 'status': 'active'})
        self.assertEqual(len(self.calls), 1)

    def test_queue_is_never_start_permission(self):
        self.state['active_leases'] = []
        self.state['queued_requests'] = [self.record]
        with self.assertRaisesRegex(ValueError, 'no exact active lease'):
            self.execute()
        self.assertEqual(len(self.calls), 1)

    def test_current_cli_email_section_is_supported_but_duplicate_alias_is_not(self):
        self.config['local_smtp'] = self.config.pop('inbucket')
        self.assertEqual(self.execute('check')['api_port'], 62321)
        self.config['inbucket'] = dict(self.config['local_smtp'])
        with self.assertRaisesRegex(ValueError, 'not both aliases'):
            self.execute()

    def test_all_identity_scope_and_kind_mismatches_deny_start(self):
        for key in ['source_thread_id', 'project_id', 'checkout', 'scope', 'kind', 'status']:
            with self.subTest(key=key):
                old = self.record[key]
                self.record[key] = 'different'
                with self.assertRaises(ValueError):
                    self.execute()
                self.record[key] = old
        self.assertFalse(any(call[0][0] == 'supabase' for call in self.calls))

    def test_legacy_schema_denies_start(self):
        self.state['schema'] = 1
        with self.assertRaisesRegex(ValueError, 'Legacy'):
            self.execute()

    def test_wrong_runtime_or_canonical_checkout_fails_before_ledger(self):
        for key, value in [('DOCKER_HOST', 'unix:///wrong.sock'), ('DOCKER_CONTEXT', 'default'),
                           ('SLOT_DIR', str(self.base))]:
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    helper.execute('start', {**self.env, key: value}, self.runner)
        self.assertEqual(self.calls, [])

    def test_linked_state_and_public_token_file_are_rejected(self):
        linked = self.checkout / 'supabase/.temp'
        linked.mkdir()
        (linked / 'project-ref').write_text('hosted-target')
        with self.assertRaisesRegex(ValueError, 'hosted linkage'):
            self.execute()
        (linked / 'project-ref').unlink()
        linked.rmdir()
        self.token.chmod(0o644)
        with self.assertRaisesRegex(ValueError, '0600'):
            self.execute()
        self.assertEqual(self.calls, [])

    def test_cli_version_cache_allows_check_and_project_stop(self):
        cache = self.checkout / 'supabase/.temp'
        cache.mkdir()
        (cache / 'cli-latest').write_text('v2.117.0')
        self.assertEqual(self.execute('check')['status'], 'active')
        self.assertEqual(self.execute('stop')['status'], 'released')
        self.assertEqual(self.calls[-2][0], ['supabase', 'stop', '--project-id', self.record['project_id']])
        self.assertEqual(self.calls[-1][0][2], 'release')

    def test_unknown_or_symlinked_cli_cache_is_rejected(self):
        cache = self.checkout / 'supabase/.temp'
        cache.mkdir()
        (cache / 'cli-latest').symlink_to(self.token)
        with self.assertRaisesRegex(ValueError, 'hosted linkage'):
            self.execute('check')
        self.assertEqual(self.calls, [])

    def test_optional_and_duplicate_ports_are_rejected(self):
        self.config['analytics']['port'] = 54327
        with self.assertRaisesRegex(ValueError, 'every local/optional port'):
            self.execute()
        self.config['analytics']['port'] = 62327
        self.config['unexpected'] = {'port': 62327}
        with self.assertRaisesRegex(ValueError, 'Unexpected or duplicate'):
            self.execute()

    def test_failed_check_or_stop_never_starts_or_releases(self):
        def failed_check(args, **kwargs):
            self.calls.append((args, kwargs))
            return subprocess.CompletedProcess(args, 1, '', 'not logged')
        with self.assertRaises(ValueError):
            helper.execute('start', self.env, failed_check)
        self.assertEqual(len(self.calls), 1)
        self.calls.clear()
        def failed_stop(args, **kwargs):
            if args[0] == 'supabase':
                self.calls.append((args, kwargs))
                return subprocess.CompletedProcess(args, 1)
            return self.runner(args, **kwargs)
        with self.assertRaises(ValueError):
            helper.execute('stop', self.env, failed_stop)
        self.assertEqual(len(self.calls), 2)

    def test_unknown_actions_and_global_flags_are_rejected(self):
        with self.assertRaises(ValueError):
            self.execute('reset')
        self.assertEqual(self.calls, [])
        result = subprocess.run([os.sys.executable, str(Path(helper.__file__)), '--all'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn('unrecognized arguments', result.stderr)

    def test_shell_wrapper_preserves_actions_without_executing_them_on_source(self):
        scripts = self.base / 'wrapper/scripts'
        scripts.mkdir(parents=True)
        runtime = self.base / 'runtime-env-stub.sh'
        # Match the canonical script's dual source/execute behaviour without runtime access.
        runtime.write_text('if [ "$#" -gt 0 ]; then "$@"; fi\n')
        source = Path(helper.__file__).with_name('start-local-supabase.sh').read_text()
        source = source.replace('/Users/botmaster/.codex/skills/local-supabase-coordinator/scripts/runtime-env.sh', str(runtime))
        (scripts / 'start-local-supabase.sh').write_text(source)
        (scripts / 'local-supabase-session.py').write_text('import json,sys; print(json.dumps(sys.argv[1:]))\n')
        for action in ['check', 'start', 'stop']:
            with self.subTest(action=action):
                result = subprocess.run(['zsh', str(scripts / 'start-local-supabase.sh'), action],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout), [action])

    def test_shell_wrapper_does_not_fall_back_after_runtime_source_failure(self):
        scripts = self.base / 'failed-wrapper/scripts'
        scripts.mkdir(parents=True)
        runtime = self.base / 'failed-runtime.sh'
        runtime.write_text('return 1\n')
        source = Path(helper.__file__).with_name('start-local-supabase.sh').read_text()
        source = source.replace('/Users/botmaster/.codex/skills/local-supabase-coordinator/scripts/runtime-env.sh', str(runtime))
        (scripts / 'start-local-supabase.sh').write_text(source)
        (scripts / 'local-supabase-session.py').write_text('print("UNSAFE FALLBACK")\n')
        result = subprocess.run(['zsh', str(scripts / 'start-local-supabase.sh'), 'check'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('UNSAFE FALLBACK', result.stdout)


if __name__ == '__main__':
    unittest.main()
