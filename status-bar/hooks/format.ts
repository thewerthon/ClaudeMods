const fullPercentage = 100;
const tokensPerThousand = 1000;
const tokensPerMillion = 1000000;
const millisecondsPerSecond = 1000;
const millisecondsPerMinute = 60000;
const minutesPerHour = 60;
const costDecimals = 2;
const millionDecimals = 1;
const filledBarCharacter = "█";
const emptyBarCharacter = "░";
const hourSuffix = "h";
const minuteDigits = 2;
const homeSymbol = "~";
const directorySeparators = ["\\", "/"];
const weekdayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// A family, a major version and an optional one- or two-digit minor version; a dated suffix is not a minor version.
const modelIdPattern = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/;

/** Returns a token count abbreviated with a thousand or million suffix. */
export function formatTokenCount(count: number): string {

	// Thousands that round up to a full million are shown as millions.
	if (Math.round(count / tokensPerThousand) >= tokensPerThousand) {

		return `${Number((count / tokensPerMillion).toFixed(millionDecimals))}M`;

	}

	if (count >= tokensPerThousand) return `${Math.round(count / tokensPerThousand)}k`;

	return String(count);

}

/** Returns a bar of the given width, filled in proportion to a percentage. */
export function formatProgressBar(percentage: number, width: number): string {

	const filledCount = Math.min(Math.max(Math.round(percentage / fullPercentage * width), 0), width);

	return filledBarCharacter.repeat(filledCount) + emptyBarCharacter.repeat(width - filledCount);

}

/** Returns a duration in hours and minutes, in minutes alone under an hour, or in seconds under a minute. */
export function formatDuration(milliseconds: number): string {

	const totalMinutes = Math.floor(milliseconds / millisecondsPerMinute);
	const hours = Math.floor(totalMinutes / minutesPerHour);
	const minutes = totalMinutes % minutesPerHour;

	if (totalMinutes === 0) return `${Math.floor(milliseconds / millisecondsPerSecond)}s`;
	if (hours === 0) return `${minutes}m`;

	return `${hours}h ${minutes}m`;

}

/** Returns an amount in US dollars with two decimals. */
export function formatCost(usd: number): string {

	return `$${usd.toFixed(costDecimals)}`;

}

/** Returns a time as hours with an "h" suffix, minutes only when not on the hour, optionally led by the weekday. */
export function formatResetTime(time: Date, includeDay: boolean): string {

	const minutes = time.getMinutes();
	const minuteText = minutes === 0 ? "" : String(minutes).padStart(minuteDigits, "0");
	const timeText = `${time.getHours()}${hourSuffix}${minuteText}`;

	if (!includeDay) return timeText;

	return `${weekdayAbbreviations[time.getDay()]} ${timeText}`;

}

/** Returns a path with the home directory replaced by "~". */
export function formatDisplayPath(path: string, homeDirectory: string): string {

	const trimmedPath = trimTrailingSeparators(path);
	const trimmedHome = trimTrailingSeparators(homeDirectory);

	if (trimmedHome === "") return trimmedPath;
	if (!trimmedPath.toLowerCase().startsWith(trimmedHome.toLowerCase())) return trimmedPath;

	const remainder = trimmedPath.slice(trimmedHome.length);

	// Guards against sibling folders sharing the home prefix.
	if (remainder.length > 0 && !directorySeparators.includes(remainder.charAt(0))) return trimmedPath;

	return `${homeSymbol}${remainder}`;

}

/** Returns a model identifier as a short display name: its family and version, or the identifier itself. */
export function formatModelName(model: string): string {

	const match = modelIdPattern.exec(model);
	const [, family, major, minor] = match ?? [];

	if (!family || !major) return model;

	const version = minor ? `${major}.${minor}` : major;

	return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`;

}

function trimTrailingSeparators(path: string): string {

	let end = path.length;

	while (end > 0 && directorySeparators.includes(path.charAt(end - 1))) end -= 1;

	return path.slice(0, end);

}
