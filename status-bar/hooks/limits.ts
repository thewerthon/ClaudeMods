/** The usage limit windows the engine reports, by the kind it names them with. */
export const limitKinds = {
	fiveHour: "five_hour",
	sevenDay: "seven_day",
	spendLimit: "spend_limit",
} as const;

/** The short labels the status row shows each window with. */
export const limitLabels: Readonly<Record<string, string>> = {
	[limitKinds.fiveHour]: "5h",
	[limitKinds.sevenDay]: "7d",
};

/** The headings the usage pane shows; a window without one is headed by its kind. */
export const limitTitles: Readonly<Record<string, string>> = {
	[limitKinds.fiveHour]: "Current session (5h)",
	[limitKinds.sevenDay]: "Current week (7d)",
	[limitKinds.spendLimit]: "Spend limit",
};

/** Returns whether a window spans days, so its reset time is worth leading with the weekday. */
export function isMultiDayLimit(kind: string): boolean {

	return kind === limitKinds.sevenDay;

}
