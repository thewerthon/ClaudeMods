import type { EngineInterface, SessionUsage } from "claude-code";

import type { StatusBarRateLimit, StatusBarSnapshot } from "../types";
import { isPermissionMode } from "./mode-pill";
import type { PermissionMode } from "./mode-pill";

type SettingsRecord = Readonly<Record<string, unknown>>;

const gitExecutable = "git";
const gitTimeoutMilliseconds = 2000;
const defaultPermissionMode: PermissionMode = "default";

/** Gathers everything the status row draws from the session, its settings and the working copy. */
export async function collectSnapshot($: EngineInterface): Promise<StatusBarSnapshot> {

	const directory = await $.session.cwd();

	const [homeDirectory, headName, model, usage, settings] = await Promise.all([
		readHomeDirectory($),
		readHeadName($, directory),
		$.session.model(),
		$.session.usage(),
		$.settings.read(),
	]);

	return {
		directory,
		homeDirectory,
		headName,
		model,
		configuredEffort: readConfiguredEffort(settings, model),
		contextPercent: usage.context.percent ?? null,
		contextTokens: usage.context.tokens ?? null,
		contextWindow: usage.context.window,
		rateLimits: readRateLimits(usage),
	};

}

/** Returns the usage limit windows the session reports, in the shape the mod stores them. */
export function readRateLimits(usage: SessionUsage): StatusBarRateLimit[] {

	return usage.rateLimits.map(limit => ({
		kind: limit.kind,
		percentUsed: limit.percentUsed,
		resetsAt: limit.resetsAt ?? null,
	}));

}

/** Returns the effort to show: the one last observed, or else the configured one. */
export function resolveEffort(observedEffort: string | null, snapshot: StatusBarSnapshot): string | null {

	return observedEffort ?? snapshot.configuredEffort;

}

/** Returns the permission mode the settings start a session in; an unknown value reads as the default mode. */
export async function readDefaultMode($: EngineInterface): Promise<PermissionMode> {

	const permissions = readRecord(await $.settings.read({ key: "permissions" }));
	const defaultMode = permissions?.defaultMode;

	return typeof defaultMode === "string" && isPermissionMode(defaultMode) ? defaultMode : defaultPermissionMode;

}

/** Returns the signed-in account's email, or null when the session does not expose it. */
export async function readEmail($: EngineInterface): Promise<string | null> {

	try {

		return (await $.session.identity()).email ?? null;

	} catch {

		// The identity is optional detail: without it, the login shows the plan alone.
		return null;

	}

}

// Until a model request reveals the effort actually sent, the configured one is the best guess: the model's own
// setting first, then the global one.
function readConfiguredEffort(settings: SettingsRecord, model: string): string | null {

	const modelEffort = readRecord(readRecord(settings.modelSettings)?.[model])?.effortLevel;

	if (typeof modelEffort === "string") return modelEffort;

	return typeof settings.effortLevel === "string" ? settings.effortLevel : null;

}

function readRecord(value: unknown): SettingsRecord | null {

	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

	return value as SettingsRecord;

}

async function readHomeDirectory($: EngineInterface): Promise<string> {

	// The engine requires a literal variable name on each read, so the fallback cannot be a loop.
	const windowsHome = await $.env.get("USERPROFILE");

	if (windowsHome) return windowsHome;

	return (await $.env.get("HOME")) ?? "";

}

async function readHeadName($: EngineInterface, directory: string): Promise<string | null> {

	try {

		const runOptions = { timeoutMs: gitTimeoutMilliseconds };
		const branch = await $.process.run([gitExecutable, "-C", directory, "branch", "--show-current"], runOptions);

		if (branch.exitCode !== 0) return null;

		const branchName = branch.stdout.trim();

		if (branchName) return branchName;

		// A detached head has no branch name, so the abbreviated commit hash stands in for it.
		const commit = await $.process.run([gitExecutable, "-C", directory, "rev-parse", "--short", "HEAD"], runOptions);

		if (commit.exitCode !== 0) return null;

		return commit.stdout.trim() || null;

	} catch {

		// Git is optional: without it, or when it is slow to answer, the head name is simply not shown.
		return null;

	}

}
