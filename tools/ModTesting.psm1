#Requires -Version 7.0

Set-StrictMode -Version "Latest"

$terminalWindowClass = "CASCADIA_HOSTING_WINDOW_CLASS"
$closeWindowMessage = 0x0010
$leftButtonDown = 0x0002
$leftButtonUp = 0x0004
$windowWaitSeconds = 30
$pollMilliseconds = 500
$focusDelayMilliseconds = 300
$clickDelayMilliseconds = 60

# Variables a Claude Code session sets for its children; a test session that inherits them runs as a child session
# (no transcript, no colors) instead of a regular one.
$inheritedVariables = @(
	"CLAUDE_CODE_CHILD_SESSION",
	"CLAUDE_CODE_ENTRYPOINT",
	"CLAUDE_CODE_MESSAGING_SOCKET",
	"CLAUDE_CODE_SESSION_ATTENDED",
	"CLAUDE_CODE_SESSION_ID",
	"CLAUDE_PID",
	"CLAUDECODE",
	"NO_COLOR",
	"GIT_TERMINAL_PROMPT"
)

Add-Type -AssemblyName "System.Drawing"
Add-Type -AssemblyName "System.Windows.Forms"
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class ModTestingNative {

	[StructLayout(LayoutKind.Sequential)]
	public struct Rect { public int Left, Top, Right, Bottom; }

	public delegate bool EnumWindowsProc(IntPtr handle, IntPtr parameter);

	[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
	[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr handle, StringBuilder name, int length);
	[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
	[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle, out Rect rect);
	[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
	[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);
	[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
	[DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
	[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

	public static List<long> ListWindows(string className) {

		var handles = new List<long>();

		EnumWindows((handle, parameter) => {

			var name = new StringBuilder(256);

			GetClassName(handle, name, name.Capacity);

			if (IsWindowVisible(handle) && name.ToString() == className) handles.Add(handle.ToInt64());

			return true;

		}, IntPtr.Zero);

		return handles;

	}

}
"@

[ModTestingNative]::SetProcessDPIAware() | Out-Null

<#
.SYNOPSIS
Starts an isolated Claude Code session with a mod loaded, in a new terminal window.

.DESCRIPTION
Opens a new Windows Terminal window running Claude Code with the given plugin folder loaded, and waits for the window to appear.
The session starts with a clean environment, so it runs as a regular interactive session even when started from inside another Claude Code session.
The returned object identifies the session for the other commands of this module.

.PARAMETER PluginDirectory
The folder of the mod to load.

.PARAMETER WorkingDirectory
The folder the session starts in.

.PARAMETER Fullscreen
Starts the session with the fullscreen renderer, where panes dock beside the transcript.

.PARAMETER Columns
The width of the terminal window, in character cells.

.PARAMETER Rows
The height of the terminal window, in character cells.

.EXAMPLE
$session = Start-ModTestSession -PluginDirectory "FooMod" -WorkingDirectory "BarPath" -Fullscreen

.INPUTS
None
By default, this function accepts no input.

.OUTPUTS
PSCustomObject
PSTypeName = "ModTesting.Session"
The started session: its window handle and the plugin folder it loads.

.NOTES
Windows only; requires Windows Terminal (wt.exe) and Claude Code on the path.
#>
function Start-ModTestSession {

	[CmdletBinding(SupportsShouldProcess)]
	[OutputType("ModTesting.Session")]

	param(
		[Parameter(Mandatory, Position = 0)]
		[string]
		$PluginDirectory,

		[Parameter()]
		[string]
		$WorkingDirectory = $PWD.Path,

		[Parameter()]
		[switch]
		$Fullscreen,

		[Parameter()]
		[int]
		$Columns = 150,

		[Parameter()]
		[int]
		$Rows = 40
	)

	$pluginPath = (Resolve-Path -LiteralPath $PluginDirectory).Path
	$startPath = (Resolve-Path -LiteralPath $WorkingDirectory).Path

	if (-not $PSCmdlet.ShouldProcess($pluginPath, "Start Claude Code test session")) {

		return

	}

	$command = Get-SessionCommand -PluginPath $pluginPath -StartPath $startPath -Fullscreen:$Fullscreen
	$encodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
	$windowsBefore = [ModTestingNative]::ListWindows($terminalWindowClass)
	$terminalArguments = @("-w", "new", "--size", "$Columns,$Rows", "pwsh", "-NoProfile", "-EncodedCommand", $encodedCommand)

	Start-Process -FilePath "wt.exe" -ArgumentList $terminalArguments
	$handle = Wait-NewWindow -Existing $windowsBefore

	return [PSCustomObject]@{
		PSTypeName      = "ModTesting.Session"
		Handle          = $handle
		PluginDirectory = $pluginPath
	}

}

<#
.SYNOPSIS
Stops a test session and closes its terminal window.

.DESCRIPTION
Stops the Claude Code processes that load the session's plugin folder, then closes the session's terminal window.

.PARAMETER Session
The session to stop, as returned by Start-ModTestSession.

.EXAMPLE
Stop-ModTestSession -Session $session

.EXAMPLE
$session | Stop-ModTestSession

.INPUTS
PSCustomObject
PSTypeName = "ModTesting.Session"
The session to stop.

.OUTPUTS
None
By default, this function returns no output.
#>
function Stop-ModTestSession {

	[CmdletBinding(SupportsShouldProcess)]
	[OutputType([void])]

	param(
		[Parameter(Mandatory, Position = 0, ValueFromPipeline)]
		[PSTypeName("ModTesting.Session")]
		$Session
	)

	process {

		if (-not $PSCmdlet.ShouldProcess($Session.PluginDirectory, "Stop Claude Code test session")) {

			return

		}

		$pluginFilter = "*--plugin-dir*$($Session.PluginDirectory)*"
		$processes = Get-CimInstance -ClassName "Win32_Process" | Where-Object { $_.CommandLine -like $pluginFilter }

		foreach ($process in $processes) {

			Stop-Process -Id $process.ProcessId -Force -Confirm:$false -ErrorAction "SilentlyContinue"

		}

		[ModTestingNative]::PostMessage([IntPtr]$Session.Handle, $closeWindowMessage, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null

	}

}

<#
.SYNOPSIS
Saves a capture of a test session's window.

.DESCRIPTION
Brings the session's window to the front and saves what it shows as a PNG image, in physical pixels.

.PARAMETER Session
The session to capture, as returned by Start-ModTestSession.

.PARAMETER Path
The PNG file to save.

.EXAMPLE
Save-ModTestCapture -Session $session -Path "FooCapture.png"

.INPUTS
None
By default, this function accepts no input.

.OUTPUTS
None
By default, this function returns no output.
#>
function Save-ModTestCapture {

	[CmdletBinding()]
	[OutputType([void])]

	param(
		[Parameter(Mandatory, Position = 0)]
		[PSTypeName("ModTesting.Session")]
		$Session,

		[Parameter(Mandatory, Position = 1)]
		[string]
		$Path
	)

	$rect = Enter-SessionWindow -Session $Session
	$width = $rect.Right - $rect.Left
	$height = $rect.Bottom - $rect.Top
	$bitmap = [System.Drawing.Bitmap]::new($width, $height)
	$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

	try {

		$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
		$bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

	} finally {

		$graphics.Dispose()
		$bitmap.Dispose()

	}

}

<#
.SYNOPSIS
Clicks a point of a test session's window.

.DESCRIPTION
Brings the session's window to the front and clicks the left mouse button at a point given relative to the window's top-left corner, in the physical pixels of a capture.

.PARAMETER Session
The session to click in, as returned by Start-ModTestSession.

.PARAMETER X
The horizontal offset of the point from the window's left edge.

.PARAMETER Y
The vertical offset of the point from the window's top edge.

.EXAMPLE
Invoke-ModTestClick -Session $session -X 830 -Y 680

.INPUTS
None
By default, this function accepts no input.

.OUTPUTS
None
By default, this function returns no output.
#>
function Invoke-ModTestClick {

	[CmdletBinding()]
	[OutputType([void])]

	param(
		[Parameter(Mandatory, Position = 0)]
		[PSTypeName("ModTesting.Session")]
		$Session,

		[Parameter(Mandatory)]
		[int]
		$X,

		[Parameter(Mandatory)]
		[int]
		$Y
	)

	$rect = Enter-SessionWindow -Session $Session

	[ModTestingNative]::SetCursorPos($rect.Left + $X, $rect.Top + $Y) | Out-Null
	[ModTestingNative]::mouse_event($leftButtonDown, 0, 0, 0, [UIntPtr]::Zero)
	Start-Sleep -Milliseconds $clickDelayMilliseconds
	[ModTestingNative]::mouse_event($leftButtonUp, 0, 0, 0, [UIntPtr]::Zero)

}

<#
.SYNOPSIS
Types keys into a test session's window.

.DESCRIPTION
Brings the session's window to the front and sends the given keys, in the notation of System.Windows.Forms.SendKeys.

.PARAMETER Session
The session to type into, as returned by Start-ModTestSession.

.PARAMETER Keys
The keys to send, such as "+{TAB}" for Shift+Tab or "Foo{ENTER}" to submit a prompt.

.EXAMPLE
Send-ModTestKey -Session $session -Keys "+{TAB}"

.INPUTS
None
By default, this function accepts no input.

.OUTPUTS
None
By default, this function returns no output.
#>
function Send-ModTestKey {

	[CmdletBinding()]
	[OutputType([void])]

	param(
		[Parameter(Mandatory, Position = 0)]
		[PSTypeName("ModTesting.Session")]
		$Session,

		[Parameter(Mandatory, Position = 1)]
		[string]
		$Keys
	)

	Enter-SessionWindow -Session $Session | Out-Null
	[System.Windows.Forms.SendKeys]::SendWait($Keys)

}

function Get-SessionCommand {

	[CmdletBinding()]
	[OutputType([string])]

	param(
		[Parameter(Mandatory)]
		[string]
		$PluginPath,

		[Parameter(Mandatory)]
		[string]
		$StartPath,

		[Parameter()]
		[switch]
		$Fullscreen
	)

	$quote = { param($text) "'" + $text.Replace("'", "''") + "'" }
	$variableList = ($inheritedVariables | ForEach-Object -Process { & $quote $_ }) -join ","
	$lines = @(
		"foreach (`$name in @($variableList)) { Remove-Item -Path `"Env:`$name`" -ErrorAction 'SilentlyContinue' }",
		"Set-Location -LiteralPath $(& $quote $StartPath)"
	)

	if ($Fullscreen) {

		$lines += "`$env:CLAUDE_CODE_TUI_TRIAL = 'fullscreen'"

	}

	$lines += "claude --plugin-dir $(& $quote $PluginPath)"

	return $lines -join [Environment]::NewLine

}

function Wait-NewWindow {

	[CmdletBinding()]
	[OutputType([long])]

	param(
		[Parameter(Mandatory)]
		[AllowEmptyCollection()]
		[long[]]
		$Existing
	)

	$deadline = (Get-Date).AddSeconds($windowWaitSeconds)

	while ((Get-Date) -lt $deadline) {

		$added = @([ModTestingNative]::ListWindows($terminalWindowClass) | Where-Object { $_ -notin $Existing })

		if ($added.Count -gt 0) {

			return $added[0]

		}

		Start-Sleep -Milliseconds $pollMilliseconds

	}

	throw "No new terminal window appeared within $windowWaitSeconds seconds."

}

function Enter-SessionWindow {

	[CmdletBinding()]
	[OutputType("ModTestingNative+Rect")]

	param(
		[Parameter(Mandatory)]
		[PSTypeName("ModTesting.Session")]
		$Session
	)

	$handle = [IntPtr]$Session.Handle
	$rect = New-Object -TypeName "ModTestingNative+Rect"

	[ModTestingNative]::SetForegroundWindow($handle) | Out-Null
	Start-Sleep -Milliseconds $focusDelayMilliseconds
	[ModTestingNative]::GetWindowRect($handle, [ref] $rect) | Out-Null

	return $rect

}

Export-ModuleMember -Function "Start-ModTestSession", "Stop-ModTestSession", "Save-ModTestCapture", "Invoke-ModTestClick", "Send-ModTestKey"
