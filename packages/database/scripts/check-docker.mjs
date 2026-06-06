#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const result = spawnSync('docker', ['info'], { stdio: 'ignore' });

if (result.error?.code === 'ENOENT') {
  process.stderr.write(
    '\nDocker CLI not found on PATH.\n' +
      'Install a Docker-compatible runtime, then re-run `pnpm db:start`.\n' +
      'Common options: Docker Desktop, OrbStack, Colima, Rancher Desktop.\n\n'
  );
  process.exit(1);
}

if (result.status !== 0) {
  process.stderr.write(
    '\nDocker daemon is not reachable.\n' +
      'Start your Docker runtime, then re-run `pnpm db:start`.\n' +
      'Common options: Docker Desktop, OrbStack, Colima, Rancher Desktop.\n\n'
  );
  process.exit(1);
}
