' Roda focus.ps1 sem abrir janela: focus.vbs "opencode-focus:<hwnd>"
Dim fso, dir, uri
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
uri = ""
If WScript.Arguments.Count > 0 Then uri = WScript.Arguments(0)
Dim re
Set re = New RegExp
re.Pattern = "[^0-9]"
re.Global = True
uri = Left(re.Replace(uri, ""), 20)
If uri = "" Then WScript.Quit
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\focus.ps1"" """ & uri & """", 0, False
