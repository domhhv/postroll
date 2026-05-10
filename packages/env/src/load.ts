import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export type LoadEnvFileOptions = {
  importMetaUrl: string;
  relativePath?: string;
};

export function loadEnvFile({
  importMetaUrl,
  relativePath = '.env',
}: LoadEnvFileOptions): void {
  const absolutePath = fileURLToPath(new URL(relativePath, importMetaUrl));

  if (!existsSync(absolutePath)) {
    return;
  }

  dotenv.config({ path: absolutePath, override: false, quiet: true });
}
