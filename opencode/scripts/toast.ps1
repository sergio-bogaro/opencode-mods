# Toast nativo do Windows: toast.ps1 <sessionId> <titulo> <texto> [pose]
# Topo = "OpenCode" com o icone; linha em negrito = titulo da sessao; a pose fica a esquerda do texto.
param([string]$SessionId = '', [string]$Title = '', [string]$Text = '', [string]$Pose = 'sucesso')

$Root = Split-Path $PSScriptRoot -Parent
$Icon = Join-Path $Root 'assets\opencode.png'
$PoseName = $Pose -replace '[^a-z]', ''
$PoseFile = Join-Path $Root "assets\poses\$PoseName.png"
$Logo = ''
if ($PoseName -and (Test-Path -LiteralPath $PoseFile)) {
    $PoseUri = [System.Security.SecurityElement]::Escape(([Uri]$PoseFile).AbsoluteUri)
    $Logo = "<image placement='appLogoOverride' hint-crop='none' src='$PoseUri'/>"
}
$Id = $SessionId -replace '[^A-Za-z0-9-]', ''
$Title = ($Title -replace '[\x00-\x1F\x7F]', '').Trim()
if (-not $Title) { $Title = 'OpenCode' }

# App ID proprio: o Windows mostra DisplayName + IconUri no topo do toast.
$AppId = 'OpenCode.Notify'
$Key = "HKCU:\Software\Classes\AppUserModelId\$AppId"
if (-not (Test-Path $Key)) { New-Item -Path $Key -Force | Out-Null }
New-ItemProperty -Path $Key -Name DisplayName -Value 'OpenCode' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $Key -Name IconUri -Value $Icon -PropertyType ExpandString -Force | Out-Null
New-ItemProperty -Path $Key -Name ShowInSettings -Value 0 -PropertyType DWord -Force | Out-Null

# Janela que hospeda esta sessao: sobe ate o opencode.exe, pega o console dele e o dono.
$Hwnd = 0
try {
    Add-Type @"
using System; using System.Runtime.InteropServices;
public static class OpenCodeConsole {
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(int pid);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint f);
}
"@
    $P = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
    $TargetPid = 0
    for ($i = 0; $P -and $i -lt 12; $i++) {
        if ($P.ProcessId -ne $PID -and $P.Name -ieq 'opencode.exe') { $TargetPid = [int]$P.ProcessId; break }
        if ($P.ProcessId -ne $PID -and $P.Name -notmatch '^(powershell|pwsh|cmd|conhost)\.exe$' -and $P.CommandLine -and $P.CommandLine -match '(?i)opencode') {
            $TargetPid = [int]$P.ProcessId; break
        }
        $P = Get-CimInstance Win32_Process -Filter "ProcessId=$($P.ParentProcessId)"
    }
    if ($TargetPid) {
        [OpenCodeConsole]::FreeConsole() | Out-Null
        if ([OpenCodeConsole]::AttachConsole($TargetPid)) {
            $C = [OpenCodeConsole]::GetConsoleWindow()
            $R = [OpenCodeConsole]::GetAncestor($C, 3) # GA_ROOTOWNER
            $Hwnd = if ($R -ne [IntPtr]::Zero) { $R.ToInt64() } else { $C.ToInt64() }
            [OpenCodeConsole]::FreeConsole() | Out-Null
        }
    }
} catch { }

# Protocolo opencode-focus: o clique no toast chama focus.vbs, que traz a janela para frente.
$Proto = 'HKCU:\Software\Classes\opencode-focus'
$Vbs = Join-Path $PSScriptRoot 'focus.vbs'
if (-not (Test-Path "$Proto\shell\open\command")) { New-Item -Path "$Proto\shell\open\command" -Force | Out-Null }
Set-ItemProperty -Path $Proto -Name '(default)' -Value 'URL:OpenCode Focus'
New-ItemProperty -Path $Proto -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
Set-ItemProperty -Path "$Proto\shell\open\command" -Name '(default)' -Value "wscript.exe `"$Vbs`" `"%1`""
$Launch = if ($Hwnd) { "activationType='protocol' launch='opencode-focus:$Hwnd'" } else { '' }

$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$T = [System.Security.SecurityElement]::Escape($Title)
$B = [System.Security.SecurityElement]::Escape($Text)
$Xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$Xml.LoadXml("<toast $Launch><visual><binding template='ToastGeneric'>$Logo<text>$T</text><text>$B</text></binding></visual><audio src='ms-winsoundevent:Notification.Default'/></toast>")
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show([Windows.UI.Notifications.ToastNotification]::new($Xml))
