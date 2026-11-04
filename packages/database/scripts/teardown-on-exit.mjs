#!/usr/bin/env node
/**
 * Runs alongside `pnpm dev` and does nothing until dev is stopped. Then it
 * removes the containers, which also makes neon_local delete its branch.
 */
import { spawnSync } from 'node:child_process';

let tearingDown = false;

function teardown() {
  if (tearingDown) {
    return;
  }

  tearingDown = true;
  process.stdout.write('Stopping local database and deleting the Neon branch...\n');
  const down = spawnSync('docker', ['compose', 'down'], { stdio: 'inherit' });
  process.exit(down.status ?? 0);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, teardown);
}

setInterval(() => {}, 1 << 30);
