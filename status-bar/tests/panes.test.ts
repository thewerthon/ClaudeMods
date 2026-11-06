import { expect, test } from "claude-code/testing";

import { getContextPaneRows } from "../hooks/context-pane";
import { describeSessionFields, getUsagePaneRows } from "../hooks/usage-pane";
import type { UsagePaneData } from "../hooks/usage-pane";
import type { StatusBarModelUsage, StatusBarSnapshot } from "../types";

const snapshot: StatusBarSnapshot = {
	directory: "C:\\Users\\Foo\\Bar",
	homeDirectory: "C:\\Users\\Foo",
	headName: null,
	model: "claude-foo-1-2",
	configuredEffort: "low",
	contextPercent: 10,
	contextTokens: 1000,
	contextWindow: 10000,
	rateLimits: [{ kind: "five_hour", percentUsed: 6, resetsAt: null }],
};

const model: StatusBarModelUsage = {
	model: "claude-foo-1-2",
	inputTokens: 1,
	outputTokens: 2,
	cacheReadTokens: 3,
	cacheWriteTokens: 4,
	costUsd: 0.5,
	apiMilliseconds: 90000,
};

const data: UsagePaneData = {
	usage: { version: "1.2.3", sessionId: "foo", email: null, costUsd: 1.5, elapsedMilliseconds: 600000 },
	snapshot,
	effort: null,
	plan: "bar",
	models: [model],
};

test("the context pane grows with its categories", async () => {

	const breakdown = { categories: [{ name: "Foo", tokens: 1, color: "text" }], totalTokens: 1, windowTokens: 10 };

	expect(getContextPaneRows(breakdown) - getContextPaneRows(null)).toBe(1);

});

test("the session fields read the session's identity and totals", async () => {

	const fields = Object.fromEntries(describeSessionFields(data).map(field => [field.label, field.value]));

	expect(fields).toEqual({
		"Version": "1.2.3",
		"Session ID": "foo",
		"Login": "Claude Bar",
		"Model": "Foo 1.2 (low)",
		"Folder": "~\\Bar",
		"Cost": "$1.50 (estimate)",
		"Duration": "10m wall · 1m API",
	});

});

test("unknown session figures read as unknown", async () => {

	const fields = describeSessionFields({ ...data, plan: null, usage: { ...data.usage, costUsd: null } });

	expect(fields.find(field => field.label === "Login")?.value).toBe("unknown");
	expect(fields.find(field => field.label === "Cost")?.value).toBe("unknown");

});

test("the usage pane grows with its models and limit windows", async () => {

	const twoModels = [model, { ...model, model: "claude-bar-3-4" }];
	const twoLimits = [...snapshot.rateLimits, { kind: "seven_day", percentUsed: 1, resetsAt: null }];

	expect(getUsagePaneRows({ ...data, models: twoModels }) - getUsagePaneRows({ ...data, models: [] })).toBe(4);
	expect(getUsagePaneRows({ ...data, snapshot: { ...snapshot, rateLimits: twoLimits } }) - getUsagePaneRows(data)).toBe(4);

});
