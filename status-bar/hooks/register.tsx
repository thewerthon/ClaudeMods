import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { StatusBarContextBreakdown } from "../types";
import { readConfig } from "./config";
import { collectBreakdown, getContextPaneRows, renderContextPane } from "./context-pane";
import { createModeTracker } from "./mode-pill";
import { layoutRow } from "./row";
import { collectSnapshot, readDefaultMode } from "./snapshot";
import {
	addRequestUsage,
	isSubagentRecord,
	mainThreadQuerySource,
	readTextAttribute,
	telemetryAttributes,
	telemetryEvents,
} from "./telemetry";
import type { TelemetryAttributes } from "./telemetry";
import { collectUsage, getUsagePaneRows, renderUsagePane } from "./usage-pane";
import type { UsagePaneData } from "./usage-pane";
import { renderGroups } from "./view";
import type { RowActions } from "./view";

// The engine's scan only reads state references declared in the module that uses them, so the atoms live here.
const snapshotAtom = atom({ plugin: "status-bar", key: "snapshot" } as const, null);
const effortAtom = atom({ plugin: "status-bar", key: "effort" } as const, null);
const breakdownAtom = atom({ plugin: "status-bar", key: "breakdown" } as const, null);
const usageAtom = atom({ plugin: "status-bar", key: "usage" } as const, null);
const modelUsageAtom = atom({ plugin: "status-bar", key: "modelUsage" } as const, []);
const planAtom = atom({ plugin: "status-bar", key: "plan" } as const, null);

// Kept in this module so the engine's scan can read the ids the panes' render hooks match on.
const contextPaneId = "status-bar-context";
const contextPaneTitle = "Context";
const usagePaneId = "status-bar-usage";
const usagePaneTitle = "Usage";

// Turn ends and commands already refresh the row; the timer only catches changes made outside the session.
const refreshIntervalMilliseconds = 15000;
const effortLevels = ["low", "medium", "high", "xhigh", "max"];
const planModeName = "plan";
const enterPlanModeTool = "EnterPlanMode";
const narrowTerminalMessage = "Not enough room for the pane here; widen the terminal and try again.";
const dockPlacement = "dock";
const fullWidth = "100%";

// The engine draws its permission mode pill on the same row, before this tree, and shrinks it (wrapping its text)
// whenever this tree claims more than what is left, so the row's width leaves out the pill and the footer's padding.
const footerPadding = 4;
// A docked pane takes one column beyond its body: the line separating it from the transcript.
const dockFrameWidth = 1;

const commands = {
	directory: "cd",
	model: "model",
	effort: "effort",
	usage: "usage",
	compact: "compact",
	plan: "plan",
} as const;

// Module variables on purpose: render hooks may not write state, and a reload starts them over and redraws.
// While one of this mod's panes is docked beside the transcript, the engine reports the prompt hint's width as the
// transcript's, although the footer still spans the whole terminal, so the docked pane's width is claimed back.
const dockedPaneColumns = new Map<string, number>();
// Follows the permission mode to know the width of the pill the engine draws.
let modeTracker = createModeTracker(null);
// Keeps timer ticks, turn ends and commands from running overlapping refreshes.
let isRefreshing = false;

/** Registers the status bar's hooks. */
export const register: Register = (on, options) => {

	const config = readConfig(options);

	on("session.start", async ($, event, next) => {

		const result = await next(event);

		$.clock.every(refreshIntervalMilliseconds, () => void refreshSnapshot($));
		void startTracking($);

		return result;

	});

	on("turn.complete", async ($, event, next) => {

		const result = await next(event);

		if (event.agentId !== undefined) return result;

		await refreshSnapshot($);
		await refreshOpenPanes($);

		return result;

	});

	on("command.run", async ($, event, next) => {

		const result = await next(event);
		const level = (event.args ?? "").trim();

		if (event.command === commands.model) await rememberEffort($, null);
		if (event.command === commands.effort) await rememberEffort($, effortLevels.includes(level) ? level : null);
		if (event.command === commands.plan) reportModeChange($, planModeName);

		await refreshSnapshot($);

		return result;

	}).catch(($, event, next) => next(event)); // Replays the settled command instead of running it twice.

	// The engine's mode change record covers the cycle key, plan approvals and SDK changes; the hooks below cover the
	// paths that skip it. API request records carry each request's usage and the effort actually sent.
	// The matcher spells the record names out, since the engine's scan only reads literals there.
	on(
		"telemetry.log",
		{ to: "collector", event: ["permission_mode_changed", "api_request"] },
		async ($, event, next) => {

			const result = await next(event);
			const attributes = event.attributes as TelemetryAttributes;

			if (event.event === telemetryEvents.apiRequest) await recordRequest($, attributes);

			if (event.event === telemetryEvents.modeChanged && !isSubagentRecord(attributes)) {

				reportModeChange($, readTextAttribute(attributes, telemetryAttributes.toMode));

			}

			return result;

		},
	).catch(($, event, next) => next(event)); // Telemetry flows on unchanged when reading a record fails.

	on("tool.call", { tool: enterPlanModeTool }, async ($, event, next) => {

		const result = await next(event);

		if (!result.isError) reportModeChange($, planModeName);

		return result;

	}).catch(($, event, next) => next(event));

	// Every prompt carries the mode it runs in, which corrects whatever no change record announced.
	on("classic.UserPromptSubmit", ($, event, next) => {

		if (!event.agent_id && event.permission_mode) modeTracker.reportCurrent(event.permission_mode);

		return next(event);

	}).catch(($, event, next) => next(event));

	on("turn.step", async function* ($, event, next) {

		if (event.agentId === undefined) await rememberEffort($, typeof event.effort === "string" ? event.effort : null);

		return yield* next(event);

	});

	on("ui.render", { component: "PromptHint" }, async ($, event, next) => {

		const snapshot = await read($, snapshotAtom);

		if (!snapshot) return next(event);

		const effort = await read($, effortAtom);
		const elements = $.ui.resolve(event);
		const { Box } = elements;
		const dockedColumns = await getDockedColumns($, event.viewport?.isFullscreen);
		const rowWidth = getRowWidth(event.viewport?.columns, event.props.hint, dockedColumns);
		const layout = layoutRow({ snapshot, effort, config }, rowWidth ?? Number.POSITIVE_INFINITY);
		const actions = createActions($);

		return (
			<Box flexDirection="row" justifyContent="space-between" width={rowWidth ?? fullWidth}>
				<Box>{renderGroups(elements, layout.left, actions)}</Box>
				<Box>{renderGroups(elements, layout.right, actions)}</Box>
			</Box>
		);

	});

	on("ui.render", { component: "Pane", requestId: contextPaneId }, async ($, event) => {

		rememberPlacement($, contextPaneId, event.props.placement, event.props.bodyColumns);

		const breakdown = await read($, breakdownAtom);

		return renderContextPane($.ui.resolve(event), breakdown, config, () => void fillCompact($));

	});

	on("ui.render", { component: "Pane", requestId: usagePaneId }, async ($, event) => {

		rememberPlacement($, usagePaneId, event.props.placement, event.props.bodyColumns);

		const data = await readUsagePaneData($);

		return renderUsagePane($.ui.resolve(event), data, config, () => void runUsageReport($));

	});

	on("ui.close", ($, event, next) => {

		if (dockedPaneColumns.delete(event.id)) $.ui.invalidate("ui.render");

		return next(event);

	}).catch(($, event, next) => next(event));

};

function createActions($: EngineInterface): RowActions {

	return {
		directory: () => void fillCommand($, commands.directory),
		model: () => void $.command.run({ command: commands.model }),
		effort: () => void $.command.run({ command: commands.effort }),
		context: () => void toggleContextPane($),
		usage: () => void toggleUsagePane($),
	};

}

async function startTracking($: EngineInterface): Promise<void> {

	try {

		modeTracker = createModeTracker(await readDefaultMode($));

	} catch {

		// Without the settings the mode starts unknown, and the widest pill is reserved until one is learned.
		modeTracker = createModeTracker(null);

	}

	await refreshSnapshot($);

}

async function refreshSnapshot($: EngineInterface): Promise<void> {

	if (isRefreshing) return;

	isRefreshing = true;

	try {

		const latest = await collectSnapshot($);
		const current = await read($, snapshotAtom);

		if (JSON.stringify(current) !== JSON.stringify(latest)) await update($, snapshotAtom, () => latest);

	} catch {

		// A failed refresh keeps the last snapshot on screen; the next turn end, command or tick tries again.

	} finally {

		isRefreshing = false;

	}

}

async function refreshOpenPanes($: EngineInterface): Promise<void> {

	const openIds = new Set((await $.ui.panes()).map(pane => pane.id));

	if (openIds.has(contextPaneId)) await loadBreakdown($);
	if (openIds.has(usagePaneId)) await loadUsage($);

}

async function rememberEffort($: EngineInterface, effort: string | null): Promise<void> {

	if ((await read($, effortAtom)) === effort) return;

	await update($, effortAtom, () => effort);

}

function reportModeChange($: EngineInterface, mode: string | null): void {

	if (mode === null) return;

	modeTracker.reportChange(mode);
	$.ui.invalidate("ui.render");

}

async function recordRequest($: EngineInterface, attributes: TelemetryAttributes): Promise<void> {

	await update($, modelUsageAtom, totals => addRequestUsage(totals, attributes));

	if (isSubagentRecord(attributes)) return;

	const plan = readTextAttribute(attributes, telemetryAttributes.plan);
	const effort = readTextAttribute(attributes, telemetryAttributes.effort);
	const isMainThread = readTextAttribute(attributes, telemetryAttributes.querySource) === mainThreadQuerySource;

	if (plan !== null && plan !== (await read($, planAtom))) await update($, planAtom, () => plan);
	if (effort !== null && isMainThread) await rememberEffort($, effort);

}

function getRowWidth(columns: number | undefined, hint: string, dockedColumns: number): number | null {

	if (columns === undefined) return null;

	const pillWidth = modeTracker.observe(hint);

	return Math.max(columns + dockedColumns - pillWidth - footerPadding, 0);

}

async function getDockedColumns($: EngineInterface, isFullscreen: boolean | undefined): Promise<number> {

	if (!isFullscreen || dockedPaneColumns.size === 0) return 0;

	// Not every close reaches this mod's close hook, so the panes actually shown are asked for on every draw.
	const shownIds = new Set((await $.ui.panes()).filter(pane => pane.isShown).map(pane => pane.id));
	const shownColumns = [...dockedPaneColumns].filter(([id]) => shownIds.has(id)).map(([, columns]) => columns);

	if (shownColumns.length === 0) return 0;

	return Math.max(...shownColumns) + dockFrameWidth;

}

function rememberPlacement($: EngineInterface, id: string, placement: string, columns: number | undefined): void {

	const docked = placement === dockPlacement && columns !== undefined ? columns : undefined;

	if (dockedPaneColumns.get(id) === docked) return;

	if (docked === undefined) dockedPaneColumns.delete(id);
	else dockedPaneColumns.set(id, docked);

	$.ui.invalidate("ui.render");

}

async function readUsagePaneData($: EngineInterface): Promise<UsagePaneData | null> {

	const [usage, snapshot, effort, plan, models] = await Promise.all([
		read($, usageAtom),
		read($, snapshotAtom),
		read($, effortAtom),
		read($, planAtom),
		read($, modelUsageAtom),
	]);

	if (!usage || !snapshot) return null;

	return { usage, snapshot, effort, plan, models };

}

async function closeIfShown($: EngineInterface, id: string): Promise<boolean> {

	const pane = (await $.ui.panes()).find(candidate => candidate.id === id);

	if (!pane?.isShown) return false;

	await $.ui.close({ id });

	return true;

}

async function toggleContextPane($: EngineInterface): Promise<void> {

	if (await closeIfShown($, contextPaneId)) return;

	const breakdown = await loadBreakdown($);

	await openPane($, contextPaneId, contextPaneTitle, getContextPaneRows(breakdown));

}

async function toggleUsagePane($: EngineInterface): Promise<void> {

	if (await closeIfShown($, usagePaneId)) return;

	await loadUsage($);

	const data = await readUsagePaneData($);

	await openPane($, usagePaneId, usagePaneTitle, data ? getUsagePaneRows(data) : undefined);

}

async function loadBreakdown($: EngineInterface): Promise<StatusBarContextBreakdown | null> {

	const breakdown = await collectBreakdown($);

	await update($, breakdownAtom, () => breakdown);

	return breakdown;

}

async function loadUsage($: EngineInterface): Promise<void> {

	const usage = await collectUsage($);

	await update($, usageAtom, () => usage);

}

async function openPane($: EngineInterface, id: string, title: string, rows: number | undefined): Promise<void> {

	const opened = await $.ui.open({ id, title, focus: true, closeOnEscape: true, rows });

	if (opened.isPlaced) return;

	// A pane the terminal cannot seat now would pop up by itself once the terminal widens, so it is withdrawn instead.
	await $.ui.close({ id });
	$.ui.toast(narrowTerminalMessage);

}

async function fillCommand($: EngineInterface, command: string): Promise<void> {

	await $.prompt.fill({ text: `/${command} ` });

}

async function fillCompact($: EngineInterface): Promise<void> {

	await $.ui.close({ id: contextPaneId });
	await fillCommand($, commands.compact);

}

async function runUsageReport($: EngineInterface): Promise<void> {

	await $.ui.close({ id: usagePaneId });
	await $.command.run({ command: commands.usage });

}
