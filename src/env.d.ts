/// <reference path="../.astro/types.d.ts" />

interface Env {
  RATE_LIMIT_KV: KVNamespace;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
