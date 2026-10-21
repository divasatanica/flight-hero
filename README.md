# Flight Hero

An npm workspace with three private packages:

- `packages/be` — `@flight-hero/be`, the WebSocket simulation backend.
- `packages/fe` — `@flight-hero/fe`, the React + TypeScript frontend powered by Vite.
- `packages/contract` — `@flight-hero/contract`, shared TypeScript types for plane data and WebSocket messages.

## Commands

Run these from the repository root:

```sh
npm install
npm run dev       # Start backend and frontend concurrently
npm run dev:be    # Start only the backend with tsx watch
npm run dev:fe    # Start only the frontend
npm run typecheck # Check all workspaces that define a typecheck script
npm run build     # Build all workspaces that define a build script
npm start         # Start the compiled backend after building
```

The root `dev` command runs both workspace dev scripts with `concurrently` and stops both processes when either exits. Vite serves the frontend at `http://localhost:5173` by default; the backend listens on port `4000`. Run `npm run preview -w @flight-hero/fe` to preview the frontend production build.

## Shared contract

Both backend and frontend declare a dependency on `@flight-hero/contract`.
Import shared types through the package name:

```ts
import type { PlaneBasic, PlaneDetailsMessage } from "@flight-hero/contract";
```

The contract package exports types only, directly from its TypeScript source. It needs no build step and has no runtime exports. These types provide compile-time checks, not runtime validation of received messages.

Keep dependency changes in the root `package-lock.json`. For example:

```sh
npm install <dependency> -w @flight-hero/be
npm install <dependency> -w @flight-hero/fe
```

## AI commit messages

Stage the files to commit, then enter `--generate` in VS Code's Source Control
message box or run `git commit -m "--generate"`. The `prepare-commit-msg` hook
uses Codex CLI to generate the message from the staged diff. Other commit
messages are left unchanged.

Codex must be installed and signed in. When a GUI Git client does not inherit
nvm's PATH, the hook loads `${NVM_DIR:-$HOME/.nvm}/nvm.sh` to select the Node.js
version before looking for Codex again. If generation fails, the hook reports
the error and keeps the original message.

Run the hook regression tests with `node --test prepare-commit-msg.test.mjs`.

### Map adapter events

Subscribe before `init()` to receive `map-loaded`, which fires synchronously
once the map, layers, and panes have been initialized (it does not wait for the
asynchronously imported Leaflet CSS).

```ts
adapter.once("map-loaded", () => console.log("Map initialized"));
const unsubscribe = adapter.on("flightClick", ({ flightId }) => {
  console.log(flightId);
});
adapter.on("mapClick", handleMapClick);
adapter.init({ type: "leaflet", selectorID: "map" });

unsubscribe();
adapter.off("mapClick", handleMapClick);
adapter.destroy(); // Removes all event subscriptions, even before init.
```

`onFlightClick` and `onMapClick` have been replaced by `on("flightClick", handler)`
and `on("mapClick", handler)`. `on` and `once` return an unsubscribe function.
Event names and argument tuples are defined in `FlightMapEvents`; adding an event
requires declaring its tuple and emitting it at the source, without adding
per-event listener storage or subscription methods. Listeners run synchronously
in registration order; duplicate `on` subscriptions of the same function are
deduplicated. Each emission snapshots its listeners, so changes to subscriptions
affect subsequent emissions. Listener exceptions propagate to the caller.
