export async function register() {
  /**
   * Node-only env validation. The import lives behind this runtime check so
   * webpack treats it as a per-runtime split and keeps `@postroll/env/load`
   * (and its node: builtins) out of the edge / Cloudflare bundle.
   */
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    registerNode();
  }
}
