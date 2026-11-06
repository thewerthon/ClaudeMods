// The engine draws a permission mode pill ("<symbol> <indicator> on · ") on the prompt hint's row, before the mod's
// tree, and strips the current mode's text from the hint it hands the mod. Authoritative sources (the engine's mode
// change record, the mode classic hooks carry) report the mode when they can. Between them, the redraw right after a
// mode change still carries the previous mode's text in the hint, and the current mode is deduced from it with the
// engine's own cycle order. Symbol widths are counted the way the engine lays them out, one cell per symbol, even
// where the terminal paints an emoji presentation wider.

/** A permission mode, as settings name it. */
export type PermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions" | "auto" | "dontAsk";

interface PillDefinition {

	indicator: string;
	symbolWidth: number;

}

/** Follows the permission mode and answers the width of the pill the engine draws for it. */
export interface ModeTracker {

	/** Returns the width of the mode pill drawn beside the given prompt hint. */
	observe: (hint: string) => number;

	/** Sets the mode the session is known to be in, without implying it just changed. */
	reportCurrent: (mode: string) => void;

	/** Sets the mode the session has just changed to. */
	reportChange: (mode: string) => void;

}

const pills: Record<PermissionMode, PillDefinition> = {
	default: { indicator: "manual mode", symbolWidth: 1 },
	acceptEdits: { indicator: "accept edits", symbolWidth: 2 },
	plan: { indicator: "plan mode", symbolWidth: 1 },
	bypassPermissions: { indicator: "bypass permissions", symbolWidth: 2 },
	auto: { indicator: "auto mode", symbolWidth: 2 },
	dontAsk: { indicator: "don't ask", symbolWidth: 2 },
};

// Modes the cycle may skip when the session does not offer them.
const optionalModes: PermissionMode[] = ["bypassPermissions", "auto"];
const indicatorSuffix = " on";
const symbolGap = 1;
const pillSeparatorWidth = " · ".length;
const cycleHintMarker = "shift+tab";

/** Returns the mode whose pill text the hint still carries, or null when it carries none. */
export function readRevealedMode(hint: string): PermissionMode | null {

	const lowerHint = hint.toLowerCase();
	const entry = Object.entries(pills).find(([, pill]) => lowerHint.includes(`${pill.indicator}${indicatorSuffix}`));

	return entry ? (entry[0] as PermissionMode) : null;

}

/** Returns the mode the engine's cycle moves to from the given one, skipping the modes known to be unavailable. */
export function getNextMode(mode: PermissionMode, unavailable: ReadonlySet<PermissionMode>): PermissionMode {

	const isAvailable = (candidate: PermissionMode) => !unavailable.has(candidate);

	switch (mode) {

		case "default": return "acceptEdits";
		case "acceptEdits": return "plan";
		case "plan":
			if (isAvailable("bypassPermissions")) return "bypassPermissions";
			if (isAvailable("auto")) return "auto";
			return "default";
		case "bypassPermissions": return isAvailable("auto") ? "auto" : "default";
		default: return "default";

	}

}

/** Returns the width the engine lays the given mode's pill out in. */
export function getModePillWidth(mode: PermissionMode): number {

	const pill = pills[mode];

	return pill.symbolWidth + symbolGap + pill.indicator.length + indicatorSuffix.length + pillSeparatorWidth;

}

/** Returns a tracker starting from the session's initial mode, or from no known mode when it is null. */
export function createModeTracker(initialMode: PermissionMode | null): ModeTracker {

	// The engine draws no pill for the default mode until the mode has been cycled at least once.
	let currentMode = initialMode;
	let hasCycled = false;
	let lastHint = "";
	// A reported change already set the mode, so the reveal that redraw carries must not move it a step further.
	let isRevealAnswered = false;
	const unavailable = new Set<PermissionMode>();

	return {
		observe: hint => {

			const revealed = hint === lastHint ? null : readRevealedMode(hint);

			lastHint = hint;

			if (revealed !== null && isRevealAnswered) {

				isRevealAnswered = false;

			} else if (revealed !== null) {

				// A wrong guess about an optional mode means the session does not offer it.
				if (currentMode !== null && currentMode !== revealed && optionalModes.includes(currentMode)) {

					unavailable.add(currentMode);

				}

				currentMode = getNextMode(revealed, unavailable);
				hasCycled = true;

			}

			if (currentMode === null) return hint.toLowerCase().includes(cycleHintMarker) ? getWidestPillWidth() : 0;
			if (currentMode === "default" && !hasCycled) return 0;

			return getModePillWidth(currentMode);

		},
		reportCurrent: mode => {

			if (isPermissionMode(mode)) currentMode = mode;

		},
		reportChange: mode => {

			if (!isPermissionMode(mode)) return;

			currentMode = mode;
			hasCycled = true;
			isRevealAnswered = true;

		},
	};

}

/** Returns whether a value names a permission mode. */
export function isPermissionMode(mode: string): mode is PermissionMode {

	return Object.hasOwn(pills, mode);

}

function getWidestPillWidth(): number {

	return Math.max(...(Object.keys(pills) as PermissionMode[]).map(getModePillWidth));

}
