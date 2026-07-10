# audienceforge-js

Official JavaScript/TypeScript SDK for [AudienceForge](https://audienceforge.dev) — feature flags and A/B testing.

- Zero production dependencies (uses native `fetch`).
- In-memory cache with configurable TTL.
- Silent fallback: API errors never throw to your code — you always get a safe default.
- Works in modern browsers and Node.js 18+. Ships ESM + CJS + type definitions.

## Install

```bash
pnpm add audienceforge-js
# or: npm i audienceforge-js / yarn add audienceforge-js
```

## Quick start

```ts
import { AudienceForge } from 'audienceforge-js';

const client = AudienceForge.init({ apiKey: 'sdk-key-xxxxx' });

if (await client.isEnabled('checkout-v2', { userId: 'u123', attributes: { plan: 'pro' } })) {
  // feature on
}
```

## API

### `AudienceForge.init(config)`

| Option        | Type                  | Default                          | Description                                          |
|---------------|-----------------------|----------------------------------|------------------------------------------------------|
| `apiKey`      | `string` (required)   | —                                | Organization SDK key (sent as `Bearer` token).       |
| `apiUrl`      | `string`              | `https://api.audienceforge.dev`  | Base API URL.                                        |
| `environment` | `string`              | `production`                     | Environment to evaluate flags against.               |
| `cacheTtlMs`  | `number`              | `30000`                          | Local cache TTL in milliseconds (0 disables cache).  |
| `timeoutMs`   | `number`              | `1000`                           | Per-request timeout before falling back to default.  |
| `fetchImpl`   | `typeof fetch`        | `globalThis.fetch`               | Custom fetch implementation (Node < 18 / tests).     |

### `client.isEnabled(flagKey, userContext): Promise<boolean>`
Evaluates whether a feature flag is enabled. Fallback: `false`.

### `client.getVariant(flagKey, userContext): Promise<string>`
Returns the active variant for a flag. Fallback: `'control'`.

### `client.evaluateExperiment(experimentKey, userContext): Promise<{ variant: string }>`
Assigns a variant for an A/B experiment. Fallback: `{ variant: 'control' }`.

`UserContext`: `{ userId: string; attributes?: Record<string, string | number | boolean> }`.

## Behavior

- **Cache:** identical evaluations (same flag/experiment + `userId` + `environment` + attributes) within the TTL window do not trigger a new HTTP request.
- **Silent fallback:** timeout, network error, `4xx/5xx`, or invalid JSON all resolve with the default value — no exceptions are propagated to your code.

## Endpoints

- Flags: `POST {apiUrl}/flags/api/v1/evaluate`
- Experiments: `POST {apiUrl}/experiments/api/v1/experiments/evaluate`

## Development

```bash
pnpm install
pnpm test        # vitest (no network — fetch is mocked)
pnpm run build   # tsup → dist (ESM + CJS + d.ts)
pnpm run typecheck
```

## License

MIT
