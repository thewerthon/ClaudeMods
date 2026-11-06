import type { EngineInterface, RenderElement } from "claude-code";

import type { StatusBarModelUsage, StatusBarRateLimit, StatusBarSnapshot, StatusBarUsage } from "../types";
import { getThresholdColor } from "./config";
import type { StatusBarConfig } from "./config";
import {
	formatCost,
	formatDisplayPath,
	formatDuration,
	formatModelName,
	formatResetTime,
	formatTokenCount,
} from "./format";
import { isMultiDayLimit, limitTitles } from "./limits";
import { readEmail, resolveEffort } from "./snapshot";
import { formatLogin } from "./telemetry";
import { renderMeter } from "./view";
import type { Elements } from "./view";

/** Everything the usage pane draws besides its configuration. */
export interface UsagePaneData {

	usage: StatusBarUsage;
	snapshot: StatusBarSnapshot;
	effort: string | null;
	plan: string | null;
	models: StatusBarModelUsage[];

}

/** One labeled line of the pane's session section. */
export interface UsageField {

	label: string;
	value: string;

}

const detailsLabel = "Details";
const unknownValue = "unknown";
const labelWidth = 12;
// Rows outside the fields and the repeated sections: the session heading, a blank separator and the button.
const fixedPaneRows = 3;
// Rows the per-model section adds besides one per model: its heading and a blank separator.
const modelSectionRows = 2;
// Rows each limit window takes: its heading, its meter, its reset time and a blank separator.
const rowsPerLimit = 4;

/** Gathers the session's identity, cost and running time. */
export async function collectUsage($: EngineInterface): Promise<StatusBarUsage> {

	const [usage, now, version, sessionId, email] = await Promise.all([
		$.session.usage(),
		$.clock.now(),
		$.session.version(),
		$.session.id(),
		readEmail($),
	]);

	return {
		version: version.version,
		sessionId,
		email,
		costUsd: usage.cost?.usd ?? null,
		elapsedMilliseconds: now - usage.startedAt,
	};

}

/** Returns the labeled lines of the pane's session section. */
export function describeSessionFields(data: UsagePaneData): UsageField[] {

	const { usage, snapshot, models } = data;
	const effort = resolveEffort(data.effort, snapshot);
	const modelName = formatModelName(snapshot.model);
	const apiMilliseconds = models.reduce((total, model) => total + model.apiMilliseconds, 0);

	return [
		{ label: "Version", value: usage.version },
		{ label: "Session ID", value: usage.sessionId },
		{ label: "Login", value: formatLogin(data.plan, usage.email) ?? unknownValue },
		{ label: "Model", value: effort ? `${modelName} (${effort})` : modelName },
		{ label: "Folder", value: formatDisplayPath(snapshot.directory, snapshot.homeDirectory) },
		{ label: "Cost", value: usage.costUsd === null ? unknownValue : `${formatCost(usage.costUsd)} (estimate)` },
		{
			label: "Duration",
			value: `${formatDuration(usage.elapsedMilliseconds)} wall · ${formatDuration(apiMilliseconds)} API`,
		},
	];

}

/** Returns how many rows the pane needs to show the given data. */
export function getUsagePaneRows(data: UsagePaneData): number {

	const modelRows = data.models.length === 0 ? 0 : modelSectionRows + data.models.length;

	return fixedPaneRows + describeSessionFields(data).length + modelRows + data.snapshot.rateLimits.length * rowsPerLimit;

}

/** Draws the session's details, the usage by model, each limit window as a meter, and a button for the full report. */
export function renderUsagePane(
	elements: Elements,
	data: UsagePaneData | null,
	config: StatusBarConfig,
	onDetails: () => void,
): RenderElement {

	const { Box, Button, Text } = elements;

	if (!data) return <Text color={config.colors.muted}>No usage data yet.</Text>;

	return (
		<Box flexDirection="column">
			<Text bold>Session</Text>
			{describeSessionFields(data).map(field => renderField(elements, field, config))}
			<Text> </Text>
			{renderModels(elements, data.models, config)}
			{data.snapshot.rateLimits.map(limit => renderLimit(elements, limit, config))}
			<Button key="details" variant="primary" label={detailsLabel} onPress={onDetails} />
		</Box>
	);

}

function renderField(elements: Elements, field: UsageField, config: StatusBarConfig): RenderElement {

	const { Text } = elements;

	return (
		<Text key={field.label}>
			{`${field.label}:`.padEnd(labelWidth)}
			<Text color={config.colors.muted}>{field.value}</Text>
		</Text>
	);

}

function renderModels(elements: Elements, models: StatusBarModelUsage[], config: StatusBarConfig): RenderElement {

	const { Box, Text } = elements;

	if (models.length === 0) return <Box />;

	return (
		<Box flexDirection="column">
			<Text bold>Usage by model (since launch)</Text>
			{models.map(model => (
				<Text key={model.model}>
					{formatModelName(model.model)}:{" "}
					<Text color={config.colors.muted}>
						{formatTokenCount(model.inputTokens)} in · {formatTokenCount(model.outputTokens)} out ·{" "}
						{formatTokenCount(model.cacheReadTokens)} cache read · {formatTokenCount(model.cacheWriteTokens)} cache
						write · {formatCost(model.costUsd)}
					</Text>
				</Text>
			))}
			<Text> </Text>
		</Box>
	);

}

function renderLimit(elements: Elements, limit: StatusBarRateLimit, config: StatusBarConfig): RenderElement {

	const { Box, Text } = elements;
	const color = getThresholdColor(limit.percentUsed, config.usageThresholds, config.colors);
	const resetText = limit.resetsAt
		? `Resets ${formatResetTime(new Date(limit.resetsAt), isMultiDayLimit(limit.kind))}`
		: "";

	return (
		<Box key={limit.kind} flexDirection="column">
			<Text bold>{limitTitles[limit.kind] ?? limit.kind}</Text>
			{renderMeter(elements, limit.percentUsed, color)}
			<Text color={config.colors.muted}>{resetText}</Text>
			<Text> </Text>
		</Box>
	);

}
