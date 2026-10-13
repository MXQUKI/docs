import { spawnSync } from 'node:child_process';
const result = spawnSync(process.env.NICE_TEST_PYTHON ?? 'python3', ['tests/browser_i18n.py'], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
