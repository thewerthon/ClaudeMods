/** One usage limit window as last reported. */
export interface StatusBarRateLimit {

	kind: string;
	percentUsed: number;
	resetsAt: string | null;

}

/** Everything the status row draws, gathered outside of drawing. */
export interface StatusBarSnapshot {

	directory: string;
	homeDirectory: string;
	headName: string | null;
	model: string;
	configuredEffort: string | null;
	contextPercent: number | null;
	contextTokens: number | null;
	contextWindow: number;
	rateLimits: StatusBarRateLimit[];

}

/** One row of the context window's breakdown by category. */
export interface StatusBarContextCategory {

	name: string;
	tokens: number;
	color: string;

}

/** The context window broken down by category, estimated locally. */
export interface StatusBarContextBreakdown {

	categories: StatusBarContextCategory[];
	totalTokens: number;
	windowTokens: number;

}

/** What one model's requests have added up to. */
export interface StatusBarModelUsage {

	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	costUsd: number;
	apiMilliseconds: number;

}

/** The session's identity, cost and running time. */
export interface StatusBarUsage {

	version: string;
	sessionId: string;
	email: string | null;
	costUsd: number | null;
	elapsedMilliseconds: number;

}

declare module "claude-code" {

	interface PluginState {

		"status-bar": {
			snapshot: StatusBarSnapshot | null;
			effort: string | null;
			breakdown: StatusBarContextBreakdown | null;
			usage: StatusBarUsage | null;
			modelUsage: StatusBarModelUsage[];
			plan: string | null;
		};

	}

}
