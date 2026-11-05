#!/usr/bin/env node
/**
 * Local dev only: hold `next dev` until the gateway (and, through its /health
 * check, Postgres) answers. Otherwise the first requests after `pnpm dev` hit a
 * gateway that is still booting and render with failed fetches.
 */
import { existsSync } from 'node:fs';

const TIMEOUT_MS = 120_000;
const INTERVAL_MS = 500;

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const gatewayUrl = process.env['GATEWAY_URL'];

if (!gatewayUrl) {
  process.exit(0);
}

const healthUrl = new URL('health', gatewayUrl.endsWith('/') ? gatewayUrl : `${gatewayUrl}/`);
const deadline = Date.now() + TIMEOUT_MS;

async function isHealthy() {
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });

    return res.ok;
  } catch {
    return false;
  }
}

process.stdout.write(`Waiting for gateway at ${healthUrl.href}...\n`);

while (!(await isHealthy())) {
  if (Date.now() > deadline) {
    process.stderr.write(`Gateway not healthy after ${TIMEOUT_MS / 1000}s, starting anyway.\n`);
    process.exit(0);
  }

  await new Promise((resolve) => {
    setTimeout(resolve, INTERVAL_MS);
  });
}

process.stdout.write('Gateway is up.\n');
