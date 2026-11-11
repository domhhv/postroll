#!/usr/bin/env node
/**
 * Runs alongside `pnpm dev` and does nothing until dev is stopped. Then it
 * removes the RabbitMQ container and its data.
 */
import { spawnSync } from 'node:child_process';

let tearingDown = false;

function teardown() {
  if (tearingDown) {
    return;
  }

  tearingDown = true;
  process.stdout.write('Stopping local RabbitMQ...\n');
  const down = spawnSync('docker', ['compose', 'down', '--volumes'], { stdio: 'inherit' });
  process.exit(down.status ?? 0);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, teardown);
}

setInterval(() => {}, 1 << 30);
