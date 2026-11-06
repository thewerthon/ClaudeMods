import { expect, test } from "claude-code/testing";

import { getThresholdColor, readConfig } from "../hooks/config";

const colors = { normal: "#000001", warning: "#000002", critical: "#000003" };

test("missing options fall back to visible elements, no decorations and the default thresholds", async () => {

	const config = readConfig({});

	expect(config.visibility).toEqual({ location: true, model: true, effort: true, context: true, usage: true });
	expect(config.decorations).toEqual({ contextBar: false, usageBars: false, contextLabel: false, usageLabel: false });
	expect(config.contextThresholds).toEqual({ warning: 50, critical: 80 });

});

test("non-finite thresholds fall back to the defaults", async () => {

	const config = readConfig({ contextWarningPercent: Number.NaN, contextCriticalPercent: Number.POSITIVE_INFINITY });

	expect(config.contextThresholds).toEqual({ warning: 50, critical: 80 });

});

test("options stored with the wrong type are ignored", async () => {

	const config = readConfig({ showModel: "no", pathColor: 42, contextWarningPercent: "high" });

	expect(config.visibility.model).toBe(true);
	expect(config.colors.path).toBeUndefined();
	expect(config.contextThresholds.warning).toBe(50);

});

test("blank colors fall back to the terminal's default", async () => {

	expect(readConfig({ pathColor: "  " }).colors.path).toBeUndefined();
	expect(readConfig({ pathColor: " #123456 " }).colors.path).toBe("#123456");

});

test("thresholds are clamped to a percentage and kept in order", async () => {

	const config = readConfig({ usageWarningPercent: 120, usageCriticalPercent: -5 });

	expect(config.usageThresholds).toEqual({ warning: 0, critical: 100 });

});

test("the threshold color follows the level a percentage reached", async () => {

	const thresholds = { warning: 50, critical: 80 };

	expect(getThresholdColor(49, thresholds, colors)).toBe(colors.normal);
	expect(getThresholdColor(50, thresholds, colors)).toBe(colors.warning);
	expect(getThresholdColor(80, thresholds, colors)).toBe(colors.critical);

});
