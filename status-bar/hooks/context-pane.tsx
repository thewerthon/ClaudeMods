import type { EngineInterface, RenderElement } from "claude-code";

import type { StatusBarContextBreakdown, StatusBarContextCategory } from "../types";
import { getThresholdColor } from "./config";
import type { StatusBarConfig } from "./config";
import { formatTokenCount } from "./format";
import { renderMeter } from "./view";
import type { Elements } from "./view";

const fullPercentage = 100;
const shareDecimals = 1;
const categoryMarker = "■ ";
const deferredKind = "deferred";
const compactLabel = "Compact";
// Rows around the categories: the title, the meter, the total, two blank separators and the button.
const fixedPaneRows = 6;

/** Estimates the context window's breakdown locally, without adding anything to the conversation. */
export async function collectBreakdown($: EngineInterface): Promise<StatusBarContextBreakdown | null> {

	const usage = await $.session.usage({ breakdown: "summary" });
	const breakdown = usage.context.breakdown;

	if (!breakdown) return null;

	return {
		categories: breakdown.categories
			.filter(category => category.kind !== deferredKind)
			.map(category => ({ name: category.name, tokens: category.tokens, color: category.color })),
		totalTokens: breakdown.totalTokens,
		windowTokens: breakdown.rawMaxTokens,
	};

}

/** Returns how many rows the pane needs to show the given breakdown. */
export function getContextPaneRows(breakdown: StatusBarContextBreakdown | null): number {

	return (breakdown?.categories.length ?? 0) + fixedPaneRows;

}

/** Draws the context window's use as a meter, one row per category, and a button that prepares a compaction. */
export function renderContextPane(
	elements: Elements,
	breakdown: StatusBarContextBreakdown | null,
	config: StatusBarConfig,
	onCompact: () => void,
): RenderElement {

	const { Box, Button, Text } = elements;

	if (!breakdown) return <Text color={config.colors.muted}>No context data yet.</Text>;

	const usedPercentage = getShare(breakdown.totalTokens, breakdown.windowTokens);
	const color = getThresholdColor(usedPercentage, config.contextThresholds, config.colors);

	return (
		<Box flexDirection="column">
			<Text bold>Context window</Text>
			{renderMeter(elements, usedPercentage, color)}
			<Text color={config.colors.muted}>
				{formatTokenCount(breakdown.totalTokens)}/{formatTokenCount(breakdown.windowTokens)} tokens
			</Text>
			<Text> </Text>
			{breakdown.categories.map(category => renderCategory(elements, category, breakdown.windowTokens, config))}
			<Text> </Text>
			<Button key="compact" variant="primary" label={compactLabel} onPress={onCompact} />
		</Box>
	);

}

function renderCategory(
	elements: Elements,
	category: StatusBarContextCategory,
	windowTokens: number,
	config: StatusBarConfig,
): RenderElement {

	const { Box, Text } = elements;
	const share = getShare(category.tokens, windowTokens).toFixed(shareDecimals);

	return (
		<Box key={category.name}>
			<Text color={category.color}>{categoryMarker}</Text>
			<Text>{category.name}: </Text>
			<Text color={config.colors.muted}>{formatTokenCount(category.tokens)} ({share}%)</Text>
		</Box>
	);

}

function getShare(tokens: number, windowTokens: number): number {

	return windowTokens === 0 ? 0 : tokens / windowTokens * fullPercentage;

}
