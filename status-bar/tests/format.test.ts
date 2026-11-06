import { expect, test } from "claude-code/testing";

import {
	formatCost,
	formatDisplayPath,
	formatDuration,
	formatModelName,
	formatProgressBar,
	formatResetTime,
	formatTokenCount,
} from "../hooks/format";

test("token counts are abbreviated by their magnitude", async () => {

	expect(formatTokenCount(999)).toBe("999");
	expect(formatTokenCount(54321)).toBe("54k");
	expect(formatTokenCount(1500000)).toBe("1.5M");

});

test("thousands that round to a million are shown as millions", async () => {

	expect(formatTokenCount(999600)).toBe("1M");

});

test("bars fill in proportion and stay within their width", async () => {

	expect(formatProgressBar(50, 4)).toBe("██░░");
	expect(formatProgressBar(-10, 4)).toBe("░░░░");
	expect(formatProgressBar(250, 4)).toBe("████");

});

test("durations read in the largest fitting units", async () => {

	expect(formatDuration(3400)).toBe("3s");
	expect(formatDuration(5 * 60000)).toBe("5m");
	expect(formatDuration(65 * 60000)).toBe("1h 5m");

});

test("costs show two decimals", async () => {

	expect(formatCost(0.125)).toBe("$0.13");
	expect(formatCost(12)).toBe("$12.00");

});

test("reset times drop the minutes on the hour and can lead with the weekday", async () => {

	expect(formatResetTime(new Date(2026, 0, 4, 11, 0), false)).toBe("11h");
	expect(formatResetTime(new Date(2026, 0, 4, 9, 5), false)).toBe("9h05");
	expect(formatResetTime(new Date(2026, 0, 4, 14, 20), true)).toBe("Sun 14h20");

});

test("paths under the home folder are shortened to it", async () => {

	expect(formatDisplayPath("C:\\Users\\Foo\\Bar\\", "C:\\Users\\Foo")).toBe("~\\Bar");
	expect(formatDisplayPath("c:\\users\\foo", "C:\\Users\\Foo\\")).toBe("~");
	expect(formatDisplayPath("/home/foo/bar", "/home/foo")).toBe("~/bar");

});

test("paths outside the home folder are left whole", async () => {

	expect(formatDisplayPath("C:\\Users\\Foobar", "C:\\Users\\Foo")).toBe("C:\\Users\\Foobar");
	expect(formatDisplayPath("/srv/foo", "")).toBe("/srv/foo");
	expect(formatDisplayPath("/srv/foo", "/")).toBe("/srv/foo");

});

test("model identifiers read as family and version", async () => {

	expect(formatModelName("claude-foo-1-2")).toBe("Foo 1.2");
	expect(formatModelName("claude-foo-4-20250514")).toBe("Foo 4");
	expect(formatModelName("claude-foo-4")).toBe("Foo 4");
	expect(formatModelName("bar")).toBe("bar");

});
