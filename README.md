# Nitro: `vite dev` force-closes the dev worker when a WebSocket is open, and `close` hooks never run

Minimal reproduction, built from the [Nitro starter](https://github.com/nitrojs/starter) (`vite` template), with
`nitro@3.0.261103-rc` pinned (the current `latest`).

The starter's changes:

- `nitro.config.ts`: `features: { websocket: true }`
- `server/routes/_ws.ts`: a `defineWebSocketHandler` route that logs `open` and `close`
- `server/plugins/close-hook.ts`: a plugin that logs from the `close` hook
- `repro.mjs` (`pnpm repro`): starts `vite dev`, opens a WebSocket to `/_ws` (or not), sends `SIGINT` and reports

## Run

Node.js >= 22.22.0 (Nitro's minimum) and pnpm.

```bash
pnpm install
pnpm repro
```

Or by hand: `pnpm dev`, open a WebSocket to `/_ws` (e.g. `new WebSocket("ws://localhost:5173/_ws")` from the browser
console), then press Ctrl+C.

## Result (Node.js 26.13, Linux)

```
### Without a WebSocket
exit: 130, after SIGINT: 10 ms
worker force-closed: false
close hook ran:      true

### With an open WebSocket
exit: 130, after SIGINT: 5021 ms
worker force-closed: true
close hook ran:      false
--- output after startup ---
[repro] ws open e188c1c5-aadd-4958-b5d3-03210cfdd776
[client] ws closed with code 1006

[nitro]  WARN  Dev worker did not shut down in time, force closing it...
```

With a WebSocket open, the shutdown waits for Nitro's hard-coded 5 s `SHUTDOWN_TIMEOUT`, then the worker is terminated:
neither the plugin's `close` hook nor the route's `close` handler runs.

## With the timeout passed to the worker

The [`fix/attempt-1`](https://github.com/SharkEzz/nitro-ws-shutdown-repro/tree/fix/attempt-1) branch patches `shutdownRunner()` in `nitro/dist/_dev2.mjs`
(`patches/nitro.patch`, applied by pnpm's `patchedDependencies` in `pnpm-workspace.yaml`) to forward its timeout, as
env-runner's own `RunnerManager.shutdown()` does:

```bash
git checkout fix/attempt-1
pnpm install
pnpm repro
```

The patch:

```diff
-			manager.sendMessage({ event: "shutdown" });
+			manager.sendMessage({ event: "shutdown", timeout: SHUTDOWN_TIMEOUT });
```

```
### With an open WebSocket
exit: 130, after SIGINT: 2518 ms
worker force-closed: false
close hook ran:      true
```

The worker bounds its HTTP server close to `timeout / 2` (2.5 s), then runs the `close` hooks and exits.
