import { expect, test } from "claude-code/testing";
import type { PluginOptions } from "claude-code";

import { readConfig } from "../hooks/config";
import { elidePath, layoutRow } from "../hooks/row";
import type { RowAction, RowLayout } from "../hooks/row";
import type { StatusBarSnapshot } from "../types";

const minimumGap = 2;
const unlimitedWidth = Number.POSITIVE_INFINITY;
const allDecorations = { showContextBar: true, showUsageBars: true, showContextLabel: true, showUsageLabel: true };

const snapshot: StatusBarSnapshot = {
	directory: "C:\\Users\\Foo\\Bar\\Baz\\Qux\\Quux",
	homeDirectory: "C:\\Users\\Foo",
	headName: "main",
	model: "claude-foo-1-2",
	configuredEffort: "low",
	contextPercent: 37,
	contextTokens: 367000,
	contextWindow: 1000000,
	rateLimits: [
		{ kind: "five_hour", percentUsed: 6, resetsAt: "2026-01-01T14:20:00Z" },
		{ kind: "seven_day", percentUsed: 10, resetsAt: "2026-01-04T11:00:00Z" },
	],
};

function rowText(rowLayout: RowLayout): string {

	const join = (groups: RowLayout["left"]) => groups.flatMap(group => group.parts.map(part => part.text)).join("");

	return `${join(rowLayout.left)}${" ".repeat(minimumGap)}${join(rowLayout.right)}`;

}

function layout(
	options: PluginOptions,
	width: number = unlimitedWidth,
	overrides: Partial<StatusBarSnapshot> = {},
	effort: string | null = "high",
): RowLayout {

	return layoutRow({ snapshot: { ...snapshot, ...overrides }, effort, config: readConfig(options) }, width);

}

function layoutText(options: PluginOptions, width: number = unlimitedWidth): string {

	return rowText(layout(options, width));

}

function getActions(rowLayout: RowLayout): RowAction[] {

	return [...rowLayout.left, ...rowLayout.right].flatMap(group => (group.action ? [group.action] : []));

}

test("a wide row keeps every detail", async () => {

	const text = layoutText({});

	expect(text).toContain("~\\Bar\\Baz\\Qux\\Quux:main");
	expect(text).toContain("(367k/1M)");
	expect(text).toContain("Foo 1.2 high");
	expect(text).toMatch(/5h 6% \([^)]+\) · 7d 10%/);
	expect(text).not.toContain("█");

});

test("the configured effort stands in until one is observed", async () => {

	expect(rowText(layout({}, unlimitedWidth, {}, null))).toContain("Foo 1.2 low");

});

test("every element is one pressable group", async () => {

	expect(getActions(layout({}))).toEqual(["directory", "model", "effort", "context", "usage"]);

});

test("missing figures leave their elements out", async () => {

	const text = rowText(layout({}, unlimitedWidth, { headName: null, contextPercent: null, rateLimits: [] }));

	expect(text).toBe("~\\Bar\\Baz\\Qux\\Quux  Foo 1.2 high");

});

test("unknown limit windows and missing reset times are left out", async () => {

	const rateLimits = [
		{ kind: "five_hour", percentUsed: 6, resetsAt: null },
		{ kind: "spend_limit", percentUsed: 40, resetsAt: null },
	];

	expect(rowText(layout({}, unlimitedWidth, { rateLimits }))).toMatch(/· 5h 6%$/);

});

test("a narrower row drops the token counts before the reset times", async () => {

	const full = layoutText({});
	const text = layoutText({}, full.length - 1);

	expect(text).not.toContain("(367k/1M)");
	expect(text).toMatch(/5h 6% \(/);
	expect(text.length).toBeLessThanOrEqual(full.length - 1);

});

test("a very narrow row elides the path to fit", async () => {

	const compactLength = layoutText({}, layoutText({}).length).length;
	const withoutResets = layoutText({}, compactLength - 1);
	const width = layoutText({}, withoutResets.length - 1).length;
	const text = layoutText({}, width - 1);

	expect(text).toContain("…");
	expect(text.length).toBeLessThanOrEqual(width - 1);

});

test("the path keeps a minimum length even when nothing fits", async () => {

	expect(layoutText({}, 0)).toContain("~\\…\\Quux");

});

test("bars and labels show only when asked for", async () => {

	const text = layoutText(allDecorations);

	expect(text).toContain("Context ████░░░░░░ 37%");
	expect(text).toContain("Usage 5h ░░░░░ 6%");

});

test("bars and labels go before the path is elided", async () => {

	const withoutTokens = layoutText({}, layoutText({}).length - 1);
	const plainCompactWidth = layoutText({}, withoutTokens.length - 1).length;
	const text = layoutText(allDecorations, plainCompactWidth);

	expect(text).toBe(layoutText({}, plainCompactWidth));
	expect(text).not.toContain("…");

});

test("each label shows on its own", async () => {

	const text = layoutText({ showUsageLabel: true });

	expect(text).toContain("Usage 5h");
	expect(text).not.toContain("Context");

});

test("hidden elements leave no stray separators", async () => {

	const text = layoutText({ showModel: false, showEffort: false, showUsage: false });

	expect(text).toMatch(/:main {2}37%/);
	expect(text).not.toContain("·");

});

test("the effort can show without the model", async () => {

	expect(layoutText({ showModel: false })).toMatch(/:main {2}high · 37%/);

});

test("a hidden folder and branch leave the right side alone", async () => {

	expect(layoutText({ showFolder: false, showBranch: false }).startsWith(" ".repeat(minimumGap))).toBe(true);

});

test("the branch can show without the folder", async () => {

	expect(layoutText({ showFolder: false }).startsWith("main  ")).toBe(true);

});

test("the folder can show without the branch", async () => {

	expect(layoutText({ showBranch: false })).toMatch(/Quux {2}Foo/);

});

test("a path that fits is left whole", async () => {

	expect(elidePath("~\\Foo", 10)).toBe("~\\Foo");

});

test("a long path keeps its first and last folders", async () => {

	expect(elidePath("~\\Foo\\Bar\\Baz\\Qux", 12)).toBe("~\\…\\Qux");

});

test("a path with a long last folder is cut from the left", async () => {

	expect(elidePath("~\\FooBarBazQux", 8)).toBe("…rBazQux");

});
