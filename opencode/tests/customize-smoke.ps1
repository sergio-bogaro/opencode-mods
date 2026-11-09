# Smoke test da janela WPF, sem abrir interação: valida XAML, Load e tema alpha.
$ErrorActionPreference = 'Stop'

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
    Write-Host 'SKIP customize-smoke (Windows only)'
    exit 0
}

$root = Split-Path $PSScriptRoot -Parent
$window = Join-Path $root 'scripts\customize\window.ps1'
$stateFile = Join-Path ([System.IO.Path]::GetTempPath()) ('opencode-mods-ui-' + [guid]::NewGuid().ToString('N') + '.json')

$state = @{
    error = ''
    message = ''
    config = @(
        @{
            key = 'theme.mode'; label = 'Modo'; kind = 'choice'; value = 'dark'
            options = @('system', 'dark', 'light'); group = 'Tema'; default = 'system'
        },
        @{
            key = 'animations'; label = 'Animacoes'; kind = 'boolean'; value = $true
            group = 'Aparencia'; default = $true
        }
    )
    themes = @()
    themeDraft = @{
        name = 'smoke'; originalName = $null; source = 'new'
        palette = @{
            light = @(
                @{ path = 'text.base'; label = 'Texto'; group = 'Base'; value = '#11223380'; default = '#112233' }
            )
            dark = @(
                @{ path = 'text.base'; label = 'Texto'; group = 'Base'; value = '#11223380'; default = '#112233' }
            )
        }
    }
    themeJson = @{ revision = 0; text = '{"base":{}}' }
    activeTheme = $null
    configPath = ''
    themesDir = ''
    snapshotMode = 'dark'
    changed = 0
} | ConvertTo-Json -Depth 30 -Compress

try {
    [System.IO.File]::WriteAllText($stateFile, $state, (New-Object System.Text.UTF8Encoding($false)))
    $output = & powershell -NoProfile -STA -ExecutionPolicy Bypass -File $window $stateFile -Check 2>&1
    $code = $LASTEXITCODE
    $text = ($output | Out-String)
    if ($code -ne 0 -or $text -notmatch 'ok: 2 op') {
        Write-Host $text
        throw "customize-smoke falhou (exit=$code)"
    }
    Write-Host ('OK  customize-smoke (exit={0})' -f $code)
} finally {
    if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile -Force }
}
