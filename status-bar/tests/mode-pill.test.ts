import { expect, test } from "claude-code/testing";

import { createModeTracker, getModePillWidth, getNextMode, isPermissionMode, readRevealedMode } from "../hooks/mode-pill";

const cycleHint = "(shift+tab to cycle)";

test("a hint carrying a mode reveals it", async () => {

	expect(readRevealedMode("bypass permissions on (shift+tab to cycle)")).toBe("bypassPermissions");
	expect(readRevealedMode("manual mode on · ? for shortcuts")).toBe("default");
	expect(readRevealedMode(cycleHint)).toBeNull();

});

test("pill widths follow the engine's layout", async () => {

	expect(getModePillWidth("bypassPermissions")).toBe(27);
	expect(getModePillWidth("auto")).toBe(18);
	expect(getModePillWidth("default")).toBe(19);

});

test("the cycle skips unavailable optional modes", async () => {

	expect(getNextMode("plan", new Set())).toBe("bypassPermissions");
	expect(getNextMode("plan", new Set(["bypassPermissions"]))).toBe("auto");
	expect(getNextMode("bypassPermissions", new Set(["auto"]))).toBe("default");

});

test("the tracker deduces the current mode from the previous one the hint reveals", async () => {

	const tracker = createModeTracker("bypassPermissions");

	expect(tracker.observe(cycleHint)).toBe(getModePillWidth("bypassPermissions"));
	expect(tracker.observe(`bypass permissions on ${cycleHint}`)).toBe(getModePillWidth("auto"));
	expect(tracker.observe(cycleHint)).toBe(getModePillWidth("auto"));
	expect(tracker.observe(`auto mode on ${cycleHint}`)).toBe(getModePillWidth("default"));
	expect(tracker.observe("? for shortcuts")).toBe(getModePillWidth("default"));
	expect(tracker.observe("manual mode on · ? for shortcuts")).toBe(getModePillWidth("acceptEdits"));

});

test("the tracker learns that an optional mode is unavailable", async () => {

	const tracker = createModeTracker("plan");

	tracker.observe(`plan mode on ${cycleHint}`);
	expect(tracker.observe(`plan mode on · something else ${cycleHint}`)).toBe(getModePillWidth("auto"));

});

test("the default mode draws no pill before any cycle", async () => {

	expect(createModeTracker("default").observe("? for shortcuts")).toBe(0);

});

test("an unknown mode reserves the widest pill while the cycle hint shows", async () => {

	const tracker = createModeTracker(null);

	expect(tracker.observe(cycleHint)).toBe(getModePillWidth("bypassPermissions"));
	expect(tracker.observe("? for shortcuts")).toBe(0);

});

test("a reported change sets the mode and the reveal that follows it does not move it again", async () => {

	const tracker = createModeTracker("plan");

	tracker.reportChange("default");
	expect(tracker.observe(`plan mode on ${cycleHint}`)).toBe(getModePillWidth("default"));
	expect(tracker.observe("? for shortcuts")).toBe(getModePillWidth("default"));

});

test("a reported mode without a change corrects the guess without consuming a reveal", async () => {

	const tracker = createModeTracker("bypassPermissions");

	tracker.reportCurrent("acceptEdits");
	expect(tracker.observe(cycleHint)).toBe(getModePillWidth("acceptEdits"));
	expect(tracker.observe(`accept edits on ${cycleHint}`)).toBe(getModePillWidth("plan"));

});

test("an unknown reported mode is ignored", async () => {

	const tracker = createModeTracker("auto");

	tracker.reportChange("somethingElse");
	expect(tracker.observe(cycleHint)).toBe(getModePillWidth("auto"));

});

test("only known modes are recognized", async () => {

	expect(isPermissionMode("plan")).toBe(true);
	expect(isPermissionMode("delegate")).toBe(false);
	expect(isPermissionMode("toString")).toBe(false);

});
