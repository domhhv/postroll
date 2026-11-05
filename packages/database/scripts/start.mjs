#!/usr/bin/env node
/**
 * Boot the local stack and bring the fresh Neon branch up to the repo's
 * migrations. neon_local forks a new branch from PARENT_BRANCH_ID on every
 * container start, and the parent may lag behind, so the schema is applied
 * here instead of relying on the parent's shape.
 */
import { spawnSync } from 'node:child_process';

const TIMEOUT_MS = 90_000;
const INTERVAL_MS = 2_000;
const RETRYABLE = /P1001|P1002|P1017|Can't reach database|ECONNREFUSED|ECONNRESET|server closed the connection/i;

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

const up = run('docker', ['compose', 'up', '-d', '--wait'], { stdio: 'inherit' });

if (up.status !== 0) {
  process.exit(up.status ?? 1);
}

const deadline = Date.now() + TIMEOUT_MS;

while (true) {
  const deploy = run('prisma', ['migrate', 'deploy']);
  const output = `${deploy.stdout}${deploy.stderr}`;

  if (deploy.status === 0) {
    process.stdout.write(output);
    process.exit(0);
  }

  if (!RETRYABLE.test(output) || Date.now() > deadline) {
    process.stderr.write(output);
    process.exit(deploy.status ?? 1);
  }

  process.stdout.write('Waiting for the Neon branch to accept connections...\n');
  await new Promise((resolve) => {
    setTimeout(resolve, INTERVAL_MS);
  });
}
