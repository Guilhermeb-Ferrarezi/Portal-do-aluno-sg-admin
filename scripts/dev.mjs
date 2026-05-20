import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, '..');

const children = [
  spawn('bun', ['run', 'dev'], {
    cwd: join(projectRoot, 'api'),
    stdio: 'inherit',
  }),
  spawn('bun', ['run', 'dev'], {
    cwd: join(projectRoot, 'web'),
    stdio: 'inherit',
  }),
];

let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(code), 500).unref();
};

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shutdown(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
