# `@tschk/moonshine-adapter-conformance`

Reusable deployment contract suite for Moonshine adapters.

```ts
import { adapterConformance } from "@tschk/moonshine-adapter-conformance";
```

Adapters implement `DeploymentAdapter` from `@tschk/moonshine-framework` and
pass the same conformance tests for request handling, static assets,
streaming, and edge behavior.

`artifactConformance` additionally builds a fixture through the CLI, relocates
only its deployable output, deletes the source project, and tests it over HTTP.
Node artifacts run under plain Node.js; Cloudflare Workers run in workerd through
Miniflare. The local Vercel Build Output host applies the generated route rules
and static overrides, invoking Node functions in Node.js and Edge functions in
workerd without Node compatibility. Install Node.js 22 alongside Bun to match
the emitted Vercel Node runtime; CI pins both runtimes.

These tests cover standalone output, assets, SSR loader data, redirects, actions,
streaming, and mixed-runtime dispatch. Cloudflare checks also exercise alternating
personalized requests with Authorization, Cookie, and X-Visitor headers, retaining
the adapter's `private, no-store` behavior. They do not certify Vercel infrastructure
or replace deployed-platform verification; no deployment is performed.

See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) and
[DESIGN.md](../../DESIGN.md).
