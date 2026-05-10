#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const [moduleSpec, exportName] = process.argv.slice(2);

if (!moduleSpec || !exportName) {
  process.stderr.write(
    'Usage: postroll-check-env <module-spec> <export-name>\n',
  );
  process.exit(2);
}

const absolutePath = resolve(process.cwd(), moduleSpec);
const moduleUrl = pathToFileURL(absolutePath).href;

const imported = await import(moduleUrl);
const schema = imported[exportName];

if (!schema) {
  process.stderr.write(
    `Export "${exportName}" not found in ${moduleSpec}\n`,
  );
  process.exit(2);
}

const exampleHint = imported.envExampleHint;
const contextLabel = imported.envContextLabel;
const envFileRelativePath = imported.envFileRelativePath ?? '../.env';

const envFilePath = fileURLToPath(new URL(envFileRelativePath, moduleUrl));
if (existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath, override: false, quiet: true });
}

const result = schema.safeParse(process.env);

if (!result.success) {
  const header = contextLabel
    ? `Invalid environment for ${contextLabel}:`
    : 'Invalid environment:';
  const lines = result.error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    return `  • ${path} — ${issue.message}`;
  });
  const footer = exampleHint
    ? `\nSee ${exampleHint} for the expected variables.`
    : '';
  process.stderr.write(`\n${header}\n${lines.join('\n')}${footer}\n\n`);
  process.exit(1);
}
