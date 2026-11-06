import type { StatusBarModelUsage } from "../types";

/** The engine's collector record names this mod reads. */
export const telemetryEvents = {
	modeChanged: "permission_mode_changed",
	apiRequest: "api_request",
} as const;

/** The collector record attributes this mod reads. */
export const telemetryAttributes = {
	agentId: "agent_id",
	toMode: "to_mode",
	model: "model",
	effort: "effort",
	querySource: "query_source",
	plan: "anthropic.plan",
	inputTokens: "input_tokens",
	outputTokens: "output_tokens",
	cacheReadTokens: "cache_read_tokens",
	cacheWriteTokens: "cache_creation_tokens",
	costUsd: "cost_usd",
	durationMilliseconds: "duration_ms",
} as const;

/** The query source the engine stamps on the main conversation's own requests. */
export const mainThreadQuerySource = "repl_main_thread";

/** A collector record's attributes, as loosely typed as the engine sends them. */
export type TelemetryAttributes = Readonly<Record<string, unknown>>;

const planPrefix = "Claude ";

/** Returns whether a record came from a subagent rather than the main conversation. */
export function isSubagentRecord(attributes: TelemetryAttributes): boolean {

	return attributes[telemetryAttributes.agentId] !== undefined;

}

/** Returns a text attribute, or null when the record lacks it or holds another type. */
export function readTextAttribute(attributes: TelemetryAttributes, name: string): string | null {

	const value = attributes[name];

	return typeof value === "string" ? value : null;

}

/** Returns the per-model totals with one API request's figures added to its model's entry, the costliest first. */
export function addRequestUsage(totals: StatusBarModelUsage[], attributes: TelemetryAttributes): StatusBarModelUsage[] {

	const model = readTextAttribute(attributes, telemetryAttributes.model);

	if (model === null) return totals;

	const current = totals.find(entry => entry.model === model) ?? createEmptyUsage(model);
	const added: StatusBarModelUsage = {
		model,
		inputTokens: current.inputTokens + readNumberAttribute(attributes, telemetryAttributes.inputTokens),
		outputTokens: current.outputTokens + readNumberAttribute(attributes, telemetryAttributes.outputTokens),
		cacheReadTokens: current.cacheReadTokens + readNumberAttribute(attributes, telemetryAttributes.cacheReadTokens),
		cacheWriteTokens: current.cacheWriteTokens + readNumberAttribute(attributes, telemetryAttributes.cacheWriteTokens),
		costUsd: current.costUsd + readNumberAttribute(attributes, telemetryAttributes.costUsd),
		apiMilliseconds: current.apiMilliseconds + readNumberAttribute(attributes, telemetryAttributes.durationMilliseconds),
	};

	return [...totals.filter(entry => entry.model !== model), added].sort((left, right) => right.costUsd - left.costUsd);

}

/** Returns the subscription plan as a login label, with the email when known. */
export function formatLogin(plan: string | null, email: string | null): string | null {

	const planLabel = plan ? `${planPrefix}${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : null;

	if (planLabel && email) return `${planLabel} (${email})`;

	return planLabel ?? email;

}

function readNumberAttribute(attributes: TelemetryAttributes, name: string): number {

	const value = attributes[name];

	return typeof value === "number" && Number.isFinite(value) ? value : 0;

}

function createEmptyUsage(model: string): StatusBarModelUsage {

	return {
		model,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		costUsd: 0,
		apiMilliseconds: 0,
	};

}
