# status-bar

A Claude Code mod that enhances the status bar under the prompt with a richer, clickable and configurable view of the session, and detail panes opened from it.

## Structure

- `.claude-plugin/plugin.json`: the manifest, including every `userConfig` option and its default.
- `hooks/register.tsx`: the hooks module; owns every hook, every `$.state` atom, all module-level state, and the wiring between them.
- `hooks/snapshot.ts`: reads the session, its settings and the working copy into the snapshot the row draws.
- `hooks/context-pane.tsx`, `hooks/usage-pane.tsx`: collect and draw each pane.
- `hooks/view.tsx`: drawing helpers shared by the row and the panes.
- `hooks/config.ts`: turns the options into a typed configuration; pure.
- `hooks/row.ts`: builds the row as data (groups of styled parts) and compacts it to a width; pure.
- `hooks/mode-pill.ts`: tracks the permission mode to know the width of the engine's mode pill; pure.
- `hooks/telemetry.ts`: reads the engine's collector records; pure.
- `hooks/format.ts`, `hooks/limits.ts`: text formatting and the usage limit windows' names; pure.
- `docs/`: images the `README.md` shows.
- `types/index.d.ts`: the state contract (`PluginState`) and the shapes stored in it.
- `tests/`: `claude plugin test` suites for the pure modules and the panes' pure helpers.

## Engine constraints

`claude plugin validate` and the engine's scan refuse code that breaks these, so they hold everywhere:

- `$` is only ever called as `$.noun.method(...)`; it is never stored in a value or passed through one, so functions that need it take it as a parameter and are called by name.
- Every `atom(...)` is declared in `hooks/register.tsx`, the module that reads and writes it, with literal `plugin` and `key`.
- Hook matchers use literal values, never constants (`requestId`, `event` and the like).
- `$.env.get` takes a literal variable name.
- Render hooks never write state; values a render needs from another hook live in a module variable, and `$.ui.invalidate("ui.render")` redraws.
- Colors are hex values, color names or theme keys; `ansi:` names are refused.

## Conventions

- Pure logic stays out of `register.tsx` and gets a test file.
- The row's text is measured from the same data it is drawn from, so a new element goes through `row.ts`, never straight into JSX.
- A new option is added to `plugin.json`, read in `config.ts` and listed in `README.md`.
