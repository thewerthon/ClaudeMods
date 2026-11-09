# status-bar

A Claude Code mod that enhances the status bar under the prompt: a richer, clickable and configurable view of the session, with detail panes a click away and no separate status line to set up.

![The status row under the prompt, with the context pane open beside the transcript](docs/preview.png)

## Features

The row keeps Claude Code's own permission mode indicator and fills the rest of the line.

- **Folder and branch**: on the left, with the home folder shortened to `~`; a detached head shows its short commit hash.
- **Model and effort**: the effort in use, falling back to the configured one before the first request.
- **Context**: how much of the context window is used, with the token count.
- **Usage limits**: the 5-hour and 7-day windows, with their reset times.
- **Fitting the terminal**: when the row is too long, token counts, reset times, bars and labels go first, and the folder path is shortened only as a last resort.

Every element is clickable:

- **Folder and branch**: fills `/cd ` in the prompt.
- **Model**: runs `/model`.
- **Effort**: runs `/effort`.
- **Context**: toggles a pane with the context window broken down by category, and a button that fills `/compact `.
- **Usage limits**: toggles a pane with the session's details (version, session ID, login, model, folder, cost and duration), the usage by model and each limit window, and a button that runs `/usage`.

## Installation

Install from a Claude Code session, answering `y` to add the marketplace and picking the user scope:

```text
/plugin install status-bar --marketplace thewerthon/ClaudeMods
```

## Configuration

Options are set when installing and later under `/config`. Colors take a hex value or a color name.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `showFolder`, `showBranch`, `showModel`, `showEffort`, `showContext`, `showFiveHourUsage`, `showSevenDayUsage` | `true` | Show each element of the row. |
| `showContextBar`, `showFiveHourUsageBar`, `showSevenDayUsageBar` | `false` | Draw a bar next to the context and each usage limit percentage. |
| `showModelLabel`, `showContextLabel`, `showUsageLabel` | `false` | Lead the model, the context and the usage figures with `Model:`, `Context:` and `Usage:`. |
| `contextWarningPercent`, `contextCriticalPercent` | `50`, `80` | Context levels at which the warning and critical colors apply. |
| `usageWarningPercent`, `usageCriticalPercent` | `50`, `80` | Usage limit levels at which the warning and critical colors apply. |
| `pathColor`, `branchColor`, `modelColor`, `effortColor`, `mutedColor` | `blue`, `yellow`, `cyan`, `magenta`, `gray` | Colors of the folder, branch, model, effort and secondary details. |
| `normalColor`, `warningColor`, `criticalColor` | `green`, `yellow`, `red` | Colors of a figure below, between and above its thresholds. |

> [!TIP]
> Claude Code paints color names as fixed RGB values rather than the terminal's palette, so matching a terminal theme means setting its hex values in the color options, for example with `/plugin configure status-bar@claude-mods`.

## Limitations

The mod works within what the mod API exposes, which leaves a few gaps.

- **Terminal only**: built and tested for the terminal; the desktop app is untested.
- **Permission mode**: the mod infers the current mode to size the row around Claude Code's indicator. A session launched with `--permission-mode` differing from the configured default is sized for the default until the first prompt.
- **Usage by model**: covers the requests made since Claude Code was launched, so a resumed session leaves out what came before.
- **Panes on narrow terminals**: Claude Code does not place a pane opened from the row below about 110 columns; the mod then shows a notice instead.

## Development

The mod is TypeScript, loaded by Claude Code with no build step. From the repository root:

```text
claude --plugin-dir status-bar
claude plugin validate status-bar
claude plugin test status-bar
```

Loading the mod with `--plugin-dir` writes the API's type declarations to `.claude-plugin/types/`, which `tsconfig.json` extends; until then, editors report the missing file.
