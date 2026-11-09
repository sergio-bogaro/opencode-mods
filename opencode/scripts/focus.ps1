# Chamado ao clicar no toast: focus.ps1 "opencode-focus:<hwnd>"
param([string]$Uri = '')
$Digits = ($Uri -replace '^[^:]*:', '') -replace '[^0-9]', ''
if (-not $Digits) { exit }
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class OpenCodeFocus {
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
"@
$H = [IntPtr][long]$Digits
if (-not [OpenCodeFocus]::IsWindow($H)) { exit }
if ([OpenCodeFocus]::IsIconic($H)) { [OpenCodeFocus]::ShowWindow($H, 9) | Out-Null } # SW_RESTORE
# Um ALT simulado libera o SetForegroundWindow vindo de um processo em segundo plano.
[OpenCodeFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[OpenCodeFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
[OpenCodeFocus]::SetForegroundWindow($H) | Out-Null
