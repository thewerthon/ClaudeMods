# ClaudeMods

A personal collection of mods for [Claude Code](https://code.claude.com): function-hook plugins that change its interface and behavior from inside the session. The repository is also a plugin marketplace, so each mod installs with a single command.

## Mods

Each mod lives in its own folder, with its own `README.md` covering what it does and how to configure it.

| Mod | Description |
| --- | ----------- |
| [`status-bar`](status-bar/README.md) | Enhances Claude Code's status bar with a clickable, configurable view of the session: folder, branch, model, effort, context and usage limits. |

## Installation

Install a mod from a Claude Code session, answering `y` to add the marketplace and picking the user scope:

```text
/plugin install status-bar --marketplace thewerthon/ClaudeMods
```

From a shell, the same works with `claude plugin install status-bar --marketplace thewerthon/ClaudeMods`.

## Structure

The marketplace manifest sits at the repository root and points at each mod's folder.

- **`.claude-plugin/marketplace.json`**: lists the mods and where each one lives.
- **`<mod>/`**: one self-contained plugin per folder, with its manifest, hooks module, types and tests.
- **`tools/`**: a PowerShell module that drives mods in a live Claude Code session for testing.

## Development

Mods are developed against a local checkout. Registering the checkout as a marketplace makes Claude Code read each mod straight from its folder, so an edit applies on `/reload-plugins` with no reinstall:

```text
claude plugin marketplace add <path-to-checkout>
claude plugin install status-bar@claude-mods
```

The marketplace and each mod are validated, and each mod tested, with the Claude Code CLI:

```text
claude plugin validate .
claude plugin validate <mod-folder>
claude plugin test <mod-folder>
```

> [!NOTE]
> The mod API is in early access and may change between Claude Code releases.

## License

Personal-use license; see [`LICENSE.txt`](LICENSE.txt).
