import type { EngineInterface, RenderChildren, RenderElement } from "claude-code";

import { formatProgressBar } from "./format";
import type { RowAction, RowGroup } from "./row";

/** The element constructors a surface draws with. */
export type Elements = ReturnType<EngineInterface["ui"]["resolve"]>;

/** What pressing each kind of row group does. */
export type RowActions = Readonly<Record<RowAction, () => void>>;

/** The width of the bars the panes draw, in cells. */
export const paneBarWidth = 30;

/** Draws row groups as styled text, each group with an action as one pressable control. */
export function renderGroups(elements: Elements, groups: RowGroup[], actions: RowActions): RenderChildren[] {

	const { Button, Text } = elements;

	return groups.map(group => {

		const parts = group.parts.map(part => (
			<Text color={part.color} bold={part.bold} dimColor={part.dim}>{part.text}</Text>
		));

		if (!group.action) return parts;

		return <Button key={group.action} plain onPress={actions[group.action]}>{parts}</Button>;

	});

}

/** Draws a pane's bar for a percentage, followed by how much of it is used. */
export function renderMeter(elements: Elements, percentage: number, color: string | undefined): RenderElement {

	const { Text } = elements;

	return (
		<Text>
			<Text color={color}>{formatProgressBar(percentage, paneBarWidth)}</Text>
			<Text> {Math.round(percentage)}% used</Text>
		</Text>
	);

}
