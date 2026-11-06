import type { StatusBarRateLimit, StatusBarSnapshot } from "../types";
import { getThresholdColor } from "./config";
import type { StatusBarConfig } from "./config";
import { formatDisplayPath, formatModelName, formatProgressBar, formatResetTime, formatTokenCount } from "./format";
import { isMultiDayLimit, limitLabels } from "./limits";
import { resolveEffort } from "./snapshot";

/** One run of text in the status row, painted in one style. */
export interface RowPart {

	text: string;
	color?: string;
	bold?: boolean;
	dim?: boolean;

}

/** Parts drawn together; a group with an action is one pressable control. */
export interface RowGroup {

	action?: RowAction;
	parts: RowPart[];

}

/** The status row as data: what is aligned to the left edge and what to the right one. */
export interface RowLayout {

	left: RowGroup[];
	right: RowGroup[];

}

/** What pressing a group of the row asks for. */
export type RowAction = "directory" | "model" | "effort" | "context" | "usage";

/** What the row shows besides the snapshot: the observed effort and the person's configuration. */
export interface RowInput {

	snapshot: StatusBarSnapshot;
	effort: string | null;
	config: StatusBarConfig;

}

interface RowDetail {

	showTokens: boolean;
	showResets: boolean;
	showBars: boolean;
	showLabels: boolean;
	pathLimit: number | null;

}

const minimumGap = 2;
const minimumPathLength = 8;
const contextBarWidth = 10;
const usageBarWidth = 5;
const segmentSeparator = " · ";
const branchSeparator = ":";
const ellipsis = "…";
const contextLabel = "Context ";
const usageLabel = "Usage ";

// Tried in order until the row fits: the least useful details go first, and the path is elided only as a last resort.
// Bars and labels are only ever shown when the configuration asks for them.
const compactionSteps: RowDetail[] = [
	{ showTokens: true, showResets: true, showBars: true, showLabels: true, pathLimit: null },
	{ showTokens: false, showResets: true, showBars: true, showLabels: true, pathLimit: null },
	{ showTokens: false, showResets: false, showBars: true, showLabels: true, pathLimit: null },
	{ showTokens: false, showResets: false, showBars: false, showLabels: true, pathLimit: null },
	{ showTokens: false, showResets: false, showBars: false, showLabels: false, pathLimit: null },
];

/** Returns the most detailed row that fits the given width, eliding the path when nothing else is left to drop. */
export function layoutRow(input: RowInput, availableWidth: number): RowLayout {

	for (const detail of compactionSteps) {

		const layout = describeRow(input, detail);

		if (measureRow(layout) <= availableWidth) return layout;

	}

	const tightest = compactionSteps[compactionSteps.length - 1] as RowDetail;
	const unelided = describeRow(input, tightest);
	const pathLength = formatDisplayPath(input.snapshot.directory, input.snapshot.homeDirectory).length;
	const room = availableWidth - measureRow(unelided) + pathLength;

	return describeRow(input, { ...tightest, pathLimit: Math.max(room, minimumPathLength) });

}

/** Returns a path shortened to the given length, keeping its first and last folders when it can. */
export function elidePath(path: string, limit: number): string {

	if (path.length <= limit) return path;

	const separator = path.includes("\\") ? "\\" : "/";
	const folders = path.split(separator);
	const first = folders[0] ?? "";
	const last = folders[folders.length - 1] ?? "";

	if (folders.length > 2) {

		const kept = [first, ellipsis, last].join(separator);

		if (kept.length <= limit) return kept;

	}

	return ellipsis + path.slice(path.length - (limit - ellipsis.length));

}

function measureRow(layout: RowLayout): number {

	return measureGroups(layout.left) + minimumGap + measureGroups(layout.right);

}

function measureGroups(groups: RowGroup[]): number {

	return groups.reduce((total, group) => total + group.parts.reduce((sum, part) => sum + part.text.length, 0), 0);

}

function describeRow(input: RowInput, detail: RowDetail): RowLayout {

	const { visibility } = input.config;
	const segments = [
		visibility.model || visibility.effort ? describeModel(input) : [],
		visibility.context ? describeContext(input, detail) : [],
		visibility.usage ? describeRateLimits(input, detail) : [],
	].filter(segment => segment.length > 0);

	return {
		left: describeLocation(input, detail),
		right: segments.flatMap((segment, index) => (index === 0 ? segment : [separatorGroup(), ...segment])),
	};

}

function describeLocation({ snapshot, config }: RowInput, detail: RowDetail): RowGroup[] {

	const { visibility, colors } = config;
	const parts: RowPart[] = [];

	if (visibility.folder) {

		const path = formatDisplayPath(snapshot.directory, snapshot.homeDirectory);

		parts.push({ text: detail.pathLimit === null ? path : elidePath(path, detail.pathLimit), color: colors.path });

	}

	if (visibility.branch && snapshot.headName) {

		if (parts.length > 0) parts.push({ text: branchSeparator, color: colors.muted });
		parts.push({ text: snapshot.headName, color: colors.branch });

	}

	return parts.length > 0 ? [{ action: "directory", parts }] : [];

}

function describeModel({ snapshot, effort: observedEffort, config }: RowInput): RowGroup[] {

	const effort = config.visibility.effort ? resolveEffort(observedEffort, snapshot) : null;
	const modelPart: RowPart = { text: formatModelName(snapshot.model), color: config.colors.model, bold: true };
	const groups: RowGroup[] = config.visibility.model ? [{ action: "model", parts: [modelPart] }] : [];

	if (effort) {

		if (groups.length > 0) groups.push({ parts: [{ text: " " }] });
		groups.push({ action: "effort", parts: [{ text: effort, color: config.colors.effort }] });

	}

	return groups;

}

function describeContext({ snapshot, config }: RowInput, detail: RowDetail): RowGroup[] {

	if (snapshot.contextPercent === null) return [];

	const color = getThresholdColor(snapshot.contextPercent, config.contextThresholds, config.colors);
	const parts: RowPart[] = [];

	if (detail.showLabels && config.decorations.contextLabel) parts.push({ text: contextLabel });

	if (detail.showBars && config.decorations.contextBar) {

		parts.push({ text: `${formatProgressBar(snapshot.contextPercent, contextBarWidth)} `, color });

	}

	parts.push({ text: `${Math.round(snapshot.contextPercent)}%`, color });

	if (detail.showTokens && snapshot.contextTokens !== null) {

		const tokens = `${formatTokenCount(snapshot.contextTokens)}/${formatTokenCount(snapshot.contextWindow)}`;

		parts.push({ text: ` (${tokens})`, color: config.colors.muted });

	}

	return [{ action: "context", parts }];

}

function describeRateLimits({ snapshot, config }: RowInput, detail: RowDetail): RowGroup[] {

	const knownLimits = snapshot.rateLimits.filter(limit => Object.hasOwn(limitLabels, limit.kind));

	if (knownLimits.length === 0) return [];

	const label: RowPart[] = detail.showLabels && config.decorations.usageLabel ? [{ text: usageLabel }] : [];
	const windows = knownLimits.flatMap((limit, index) => [
		...(index === 0 ? [] : [separatorPart()]),
		...describeRateLimit(limit, config, detail),
	]);

	return [{ action: "usage", parts: [...label, ...windows] }];

}

function describeRateLimit(limit: StatusBarRateLimit, config: StatusBarConfig, detail: RowDetail): RowPart[] {

	const color = getThresholdColor(limit.percentUsed, config.usageThresholds, config.colors);
	const parts: RowPart[] = [{ text: `${limitLabels[limit.kind]} ` }];

	if (detail.showBars && config.decorations.usageBars) {

		parts.push({ text: `${formatProgressBar(limit.percentUsed, usageBarWidth)} `, color });

	}

	parts.push({ text: `${Math.round(limit.percentUsed)}%`, color });

	if (detail.showResets && limit.resetsAt) {

		const resetTime = formatResetTime(new Date(limit.resetsAt), isMultiDayLimit(limit.kind));

		parts.push({ text: ` (${resetTime})`, color: config.colors.muted });

	}

	return parts;

}

// Dimmed like the engine's own separator between the mode pill and the row, so every separator reads alike.
function separatorPart(): RowPart {

	return { text: segmentSeparator, dim: true };

}

function separatorGroup(): RowGroup {

	return { parts: [separatorPart()] };

}
