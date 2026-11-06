import { expect, test } from "claude-code/testing";

import { addRequestUsage, formatLogin, isSubagentRecord, readTextAttribute } from "../hooks/telemetry";

const request = {
	model: "claude-foo-1-2",
	input_tokens: 10,
	output_tokens: 20,
	cache_read_tokens: 300,
	cache_creation_tokens: 40,
	cost_usd: 0.5,
	duration_ms: 1500,
};

test("requests add up per model, the costliest first", async () => {

	const once = addRequestUsage([], request);
	const twice = addRequestUsage(once, request);
	const mixed = addRequestUsage(twice, { ...request, model: "claude-bar-3-4", cost_usd: 5 });

	expect(twice).toEqual([{
		model: "claude-foo-1-2",
		inputTokens: 20,
		outputTokens: 40,
		cacheReadTokens: 600,
		cacheWriteTokens: 80,
		costUsd: 1,
		apiMilliseconds: 3000,
	}]);
	expect(mixed.map(entry => entry.model)).toEqual(["claude-bar-3-4", "claude-foo-1-2"]);

});

test("a record without a model or with odd figures adds nothing broken", async () => {

	expect(addRequestUsage([], { input_tokens: 5 })).toEqual([]);
	expect(addRequestUsage([], { model: "claude-foo-1-2", input_tokens: "5" })[0]?.inputTokens).toBe(0);

});

test("subagent records are told apart", async () => {

	expect(isSubagentRecord({ agent_id: "foo" })).toBe(true);
	expect(isSubagentRecord({})).toBe(false);

});

test("text attributes are read safely", async () => {

	expect(readTextAttribute({ to_mode: "plan" }, "to_mode")).toBe("plan");
	expect(readTextAttribute({ to_mode: 1 }, "to_mode")).toBeNull();

});

test("the login label combines plan and email when both are known", async () => {

	expect(formatLogin("foo", "bar@example.com")).toBe("Claude Foo (bar@example.com)");
	expect(formatLogin(null, "bar@example.com")).toBe("bar@example.com");
	expect(formatLogin("foo", null)).toBe("Claude Foo");
	expect(formatLogin(null, null)).toBeNull();

});
