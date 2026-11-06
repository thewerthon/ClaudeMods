import type { PluginOptions } from "claude-code";

/** Which elements the row shows. */
export interface StatusBarVisibility {

	folder: boolean;
	branch: boolean;
	model: boolean;
	effort: boolean;
	context: boolean;
	usage: boolean;

}

/** Which optional bars and labels the row adds to its figures. */
export interface StatusBarDecorations {

	contextBar: boolean;
	usageBars: boolean;
	contextLabel: boolean;
	usageLabel: boolean;

}

/** The colors the row and the panes are painted with; an unset one falls back to the terminal's default text color. */
export interface StatusBarColors {

	path?: string;
	branch?: string;
	model?: string;
	effort?: string;
	muted?: string;
	normal?: string;
	warning?: string;
	critical?: string;

}

/** The percentages at which a figure turns to the warning and the critical color. */
export interface StatusBarThresholds {

	warning: number;
	critical: number;

}

/** Everything that can be configured about the mod. */
export interface StatusBarConfig {

	visibility: StatusBarVisibility;
	decorations: StatusBarDecorations;
	colors: StatusBarColors;
	contextThresholds: StatusBarThresholds;
	usageThresholds: StatusBarThresholds;

}

// The manifest's userConfig defaults are the source of truth and the engine fills them in; these fallbacks only cover
// an option stored with the wrong type.
const fallbackThresholds: StatusBarThresholds = { warning: 50, critical: 80 };
const minimumPercentage = 0;
const maximumPercentage = 100;

/** Returns the mod's configuration from its options, ignoring malformed values. */
export function readConfig(options: PluginOptions): StatusBarConfig {

	return {
		visibility: {
			folder: readFlag(options, "showFolder", true),
			branch: readFlag(options, "showBranch", true),
			model: readFlag(options, "showModel", true),
			effort: readFlag(options, "showEffort", true),
			context: readFlag(options, "showContext", true),
			usage: readFlag(options, "showUsage", true),
		},
		decorations: {
			contextBar: readFlag(options, "showContextBar", false),
			usageBars: readFlag(options, "showUsageBars", false),
			contextLabel: readFlag(options, "showContextLabel", false),
			usageLabel: readFlag(options, "showUsageLabel", false),
		},
		colors: {
			path: readColor(options, "pathColor"),
			branch: readColor(options, "branchColor"),
			model: readColor(options, "modelColor"),
			effort: readColor(options, "effortColor"),
			muted: readColor(options, "mutedColor"),
			normal: readColor(options, "normalColor"),
			warning: readColor(options, "warningColor"),
			critical: readColor(options, "criticalColor"),
		},
		contextThresholds: readThresholds(options, "contextWarningPercent", "contextCriticalPercent"),
		usageThresholds: readThresholds(options, "usageWarningPercent", "usageCriticalPercent"),
	};

}

/** Returns the color for a percentage, by the threshold it reached. */
export function getThresholdColor(
	percentage: number,
	thresholds: StatusBarThresholds,
	colors: StatusBarColors,
): string | undefined {

	if (percentage >= thresholds.critical) return colors.critical;
	if (percentage >= thresholds.warning) return colors.warning;

	return colors.normal;

}

function readColor(options: PluginOptions, key: string): string | undefined {

	const value = options[key];

	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

}

function readFlag(options: PluginOptions, key: string, fallback: boolean): boolean {

	const value = options[key];

	return typeof value === "boolean" ? value : fallback;

}

function readThresholds(options: PluginOptions, warningKey: string, criticalKey: string): StatusBarThresholds {

	const warning = readPercentage(options, warningKey) ?? fallbackThresholds.warning;
	const critical = readPercentage(options, criticalKey) ?? fallbackThresholds.critical;

	// A critical level set below the warning one would never show the warning color, so the two are kept in order.
	return { warning: Math.min(warning, critical), critical: Math.max(warning, critical) };

}

function readPercentage(options: PluginOptions, key: string): number | null {

	const value = options[key];

	if (typeof value !== "number" || !Number.isFinite(value)) return null;

	return Math.min(Math.max(value, minimumPercentage), maximumPercentage);

}
