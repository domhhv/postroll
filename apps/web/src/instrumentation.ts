export async function register() {
  /**
   * Node-only env loading. The import lives behind this runtime check so the
   * bundler treats it as a per-runtime split and keeps `@postroll/env/load`
   * (and its node: builtins) out of any edge bundle.
   */
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    registerNode();
  }
}
