# Instala o opencode-mods no OpenCode (Windows/PowerShell).
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
#   .\install.ps1 -Link          # junction para este diretório (bom para desenvolver)
#   .\install.ps1 -Uninstall     # remove o plugin
#   .\install.ps1 -Uninstall -Purge  # remove o plugin e os dados em ~/.local/share/opencode/mods
param(
    [switch]$Link,
    [switch]$Uninstall,
    [switch]$Purge
)

$ErrorActionPreference = 'Stop'
$Source = $PSScriptRoot
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$ConfigRoot = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $HomeDir '.config' }
$PluginsDir = Join-Path $ConfigRoot 'opencode\plugins'
$Target = Join-Path $PluginsDir 'opencode-mods'
$DataRoot = if ($env:XDG_DATA_HOME) { $env:XDG_DATA_HOME } else { Join-Path $HomeDir '.local\share' }
$ModsData = Join-Path $DataRoot 'opencode\mods\opencode-mods'
$CommandsDir = Join-Path $ConfigRoot 'opencode\commands'
$CommandName = 'commit.md'
$CommandSource = Join-Path $Source "commands\$CommandName"
$CommandTarget = Join-Path $CommandsDir $CommandName
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Remove-Link($path) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.LinkType -in @('Junction', 'SymbolicLink')) {
        # Remove só o link, sem seguir para o alvo.
        cmd /c rmdir "$path" | Out-Null
    } else {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

function Install-Command {
    if (-not (Test-Path -LiteralPath $CommandSource)) { return }
    New-Item -ItemType Directory -Force $CommandsDir | Out-Null
    $sourceContent = Get-Content -LiteralPath $CommandSource -Raw
    if (Test-Path -LiteralPath $CommandTarget) {
        $content = Get-Content -LiteralPath $CommandTarget -Raw
        if ($content -ne $sourceContent) {
            $backup = Join-Path $ConfigRoot "opencode\backups\opencode-mods-$Stamp\commands\$CommandName"
            New-Item -ItemType Directory -Force (Split-Path -Parent $backup) | Out-Null
            Copy-Item -LiteralPath $CommandTarget -Destination $backup -Force
            Write-Host "  comando existente guardado em $backup"
        }
    }
    Copy-Item -LiteralPath $CommandSource -Destination $CommandTarget -Force
    Write-Host "OK  comando instalado em $CommandTarget"
}

function Remove-Command {
    if (-not (Test-Path -LiteralPath $CommandTarget)) { return }
    $content = Get-Content -LiteralPath $CommandTarget -Raw
    if ($content -notlike '*opencode-mods: comando /commit*') {
        Write-Warning "  $CommandTarget nao foi criado pelo opencode-mods; nao removi."
        return
    }
    if (Test-Path -LiteralPath $CommandSource) {
        $sourceContent = Get-Content -LiteralPath $CommandSource -Raw
        if ($content -ne $sourceContent) {
            Write-Warning "  $CommandTarget foi modificado; nao removi. Se quiser, apague manualmente."
            return
        }
    }
    Remove-Item -LiteralPath $CommandTarget -Force
    Write-Host "OK  comando removido de $CommandTarget"
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $Target) {
        Remove-Link $Target
        Write-Host "OK  plugin removido de $Target"
    } else {
        Write-Host "--  plugin não estava instalado em $Target"
    }
    Remove-Command
    if ($Purge -and (Test-Path -LiteralPath $ModsData)) {
        Remove-Item -LiteralPath $ModsData -Recurse -Force
        Write-Host "OK  dados removidos de $ModsData"
    } elseif (-not $Purge) {
        Write-Host "    dados mantidos em $ModsData (use -Purge para apagar)"
    }
    exit 0
}

foreach ($required in @('server.ts', 'tui.tsx', 'rpc.ts', 'package.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $required))) {
        throw "Arquivo $required nao encontrado em $Source. Rode o instalador dentro da pasta opencode/."
    }
}

$version = $null
try {
    $version = (& opencode --version 2>$null | Select-Object -First 1)
} catch {
    $version = $null
}
if (-not $version) {
    Write-Warning 'OpenCode não encontrado no PATH. Instale o OpenCode 2.x antes de continuar.'
} else {
    Write-Host "OpenCode: $version"
    if ($version -match '(\d+)\.(\d+)') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -lt 2) {
            throw "Este plugin exige OpenCode 2.x. Versao encontrada: $version"
        }
        if ($major -eq 2 -and $minor -lt 2) {
            Write-Warning "Este plugin foi feito para OpenCode 2.2.x. Versao encontrada: $version"
        }
    }
}

New-Item -ItemType Directory -Force $PluginsDir | Out-Null

if (Test-Path -LiteralPath $Target) {
    $existing = Get-Item -LiteralPath $Target -Force
    $sameLink = $existing.LinkType -in @('Junction', 'SymbolicLink') -and (@($existing.Target) -contains $Source)
    if ($sameLink) {
        Remove-Link $Target
        Write-Host "  junction existente removida para recriar"
    } else {
        $backupRoot = Join-Path $ConfigRoot "opencode\backups"
        $backup = Join-Path $backupRoot "opencode-mods-$Stamp"
        New-Item -ItemType Directory -Force $backupRoot | Out-Null
        Move-Item -LiteralPath $Target -Destination $backup
        Write-Host "  versão anterior guardada em $backup"
    }
}

if ($Link) {
    foreach ($dependency in @('solid-js', '@opentui\solid', '@opentui\core')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Source "node_modules\$dependency"))) {
            throw "Rode 'npm install' em $Source antes de instalar com -Link (falta $dependency)."
        }
    }
    New-Item -ItemType Junction -Path $Target -Target $Source | Out-Null
    Write-Host "OK  junction criada: $Target -> $Source"
} else {
    New-Item -ItemType Directory -Force $Target | Out-Null
    foreach ($item in @('server.ts', 'tui.tsx', 'rpc.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'src', 'scripts', 'assets')) {
        $from = Join-Path $Source $item
        if (Test-Path -LiteralPath $from) {
            Copy-Item -LiteralPath $from -Destination $Target -Recurse -Force
        }
    }

    # A copia precisa das dependencias de runtime do TUI (solid-js e @opentui/*).
    # Sem elas o OpenCode falha com "Cannot find package 'solid-js'".
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
    if (-not $npm) {
        throw "npm nao encontrado no PATH. Instale o Node.js/npm ou use -Link."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $Target 'package-lock.json'))) {
        throw "package-lock.json nao encontrado. Rode 'npm install' em $Source antes de instalar."
    }

    Write-Host '  instalando dependencias de runtime...'
    Push-Location $Target
    try {
        & $npm.Source ci --omit=dev --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'npm ci falhou; tentando npm install...'
            & $npm.Source install --omit=dev --ignore-scripts --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) {
                throw "Nao consegui instalar as dependencias de runtime em $Target."
            }
        }
    } finally {
        Pop-Location
    }

    # O host fornece @opencode/plugin; uma copia local seria rejeitada pelo OpenCode.
    $foreign = Join-Path $Target 'node_modules\@opencode'
    if (Test-Path -LiteralPath $foreign) {
        Remove-Item -LiteralPath $foreign -Recurse -Force
        Write-Host '  copia local de @opencode removida (o host fornece)'
    }

    foreach ($dependency in @('solid-js', '@opentui\solid', '@opentui\core')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Target "node_modules\$dependency"))) {
            throw "Dependencia de runtime ausente: $dependency"
        }
    }
    Write-Host 'OK  plugin copiado e dependencias de runtime instaladas'
}

Install-Command

Write-Host ''
Write-Host 'Pronto. Feche e reabra o TUI do OpenCode para carregar a parte visual.'
Write-Host 'Comandos: /commit  /arquivos  /linha-do-tempo  /limpar-linha-do-tempo  /limpar-dados  /customize-opencode'
Write-Host "Dados: $ModsData"
