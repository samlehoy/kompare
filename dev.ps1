#requires -Version 5.1
<#
.SYNOPSIS
    Start, stop, or inspect the local Kompare dev stack.

.DESCRIPTION
    Runs the FastAPI backend and Next.js frontend together with a few first-run
    conveniences:

    - Creates .env from .env.example when needed.
    - Installs frontend packages when node_modules is missing.
    - Installs Python requirements when FastAPI/Uvicorn is missing.
    - Remembers child process IDs in .dev-logs/dev-state.json.
    - Stops stale listeners on the requested ports by default.
    - Supports easy status, stop, and detached workflows.

    By default the script starts both servers, opens the frontend, tails logs,
    and stops both servers when you press Ctrl+C.

.EXAMPLE
    .\dev.ps1
        Start backend + frontend, open the browser, and tail logs.

.EXAMPLE
    .\dev.ps1 -Detached
        Start backend + frontend, print URLs, and return to the prompt.

.EXAMPLE
    .\dev.ps1 -Status
        Show saved process IDs, URLs, and port state.

.EXAMPLE
    .\dev.ps1 -Stop
        Stop the saved dev servers.

.EXAMPLE
    .\dev.ps1 -NoCleanPorts
        Leave existing listeners alone and fall forward to open ports.
#>
[CmdletBinding(DefaultParameterSetName = 'Start')]
param(
    [Parameter(ParameterSetName = 'Start')]
    [int]$BackendPort = 8000,

    [Parameter(ParameterSetName = 'Start')]
    [int]$FrontendPort = 5173,

    [Parameter(ParameterSetName = 'Start')]
    [switch]$NoBrowser,

    [Parameter(ParameterSetName = 'Start')]
    [switch]$NoInstall,

    [Parameter(ParameterSetName = 'Start')]
    [switch]$Detached,

    [Parameter(ParameterSetName = 'Start')]
    [switch]$CleanPorts,

    [Parameter(ParameterSetName = 'Start')]
    [switch]$NoCleanPorts,

    [Parameter(ParameterSetName = 'Stop')]
    [switch]$Stop,

    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $root 'frontend'
$logDir = Join-Path $root '.dev-logs'
$statePath = Join-Path $logDir 'dev-state.json'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[X] $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-PortListening {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-PortOwners {
    param([int]$Port)
    @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -le 0) { return }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return }

    $taskkill = Get-Command taskkill.exe -ErrorAction SilentlyContinue
    if ($taskkill) {
        & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
        return
    }

    Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-ProcessTree -ProcessId ([int]$_.ProcessId) }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-OnPort {
    param([int]$Port)

    foreach ($owner in (Get-PortOwners $Port)) {
        Stop-ProcessTree -ProcessId ([int]$owner)
    }
}

function Get-AvailablePort {
    param([int]$PreferredPort, [int]$MaxAttempts = 30)

    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        $candidate = $PreferredPort + $i
        if (-not (Test-PortListening $candidate)) {
            return $candidate
        }
    }

    throw "No available port found from $PreferredPort to $($PreferredPort + $MaxAttempts - 1)."
}

function Wait-Port {
    param([int]$Port, [int]$TimeoutSec = 30)

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening $Port) { return $true }
        Start-Sleep -Milliseconds 300
    }

    return $false
}

function Read-State {
    if (-not (Test-Path $statePath)) { return $null }

    try {
        return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Warn "Ignoring unreadable dev state at $statePath"
        return $null
    }
}

function Save-State {
    param(
        [int]$BackendPid,
        [int]$FrontendPid,
        [int]$BackendPort,
        [int]$FrontendPort
    )

    $state = [ordered]@{
        root = $root
        backendPid = $BackendPid
        frontendPid = $FrontendPid
        backendPort = $BackendPort
        frontendPort = $FrontendPort
        backendUrl = "http://127.0.0.1:$BackendPort"
        frontendUrl = "http://127.0.0.1:$FrontendPort"
        apiProxyTarget = "http://127.0.0.1:$BackendPort"
        logs = @{
            backendOut = (Join-Path $logDir "backend-$script:sessionId.out")
            backendErr = (Join-Path $logDir "backend-$script:sessionId.err")
            frontendOut = (Join-Path $logDir "frontend-$script:sessionId.out")
            frontendErr = (Join-Path $logDir "frontend-$script:sessionId.err")
        }
        startedAt = (Get-Date).ToString('o')
    }

    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Remove-State {
    if (Test-Path $statePath) {
        Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    }
}

function Stop-SavedServers {
    $state = Read-State
    if (-not $state) {
        Write-Warn "No saved dev server state found."
        return
    }

    Write-Step "Stopping saved dev servers..."
    Stop-ProcessTree -ProcessId ([int]$state.backendPid)
    Stop-ProcessTree -ProcessId ([int]$state.frontendPid)
    Remove-State
    Write-Ok "Stopped saved dev servers."
}

function Show-Status {
    $state = Read-State
    if (-not $state) {
        Write-Warn "No saved dev server state found at $statePath"
        return
    }

    $backendAlive = [bool](Get-Process -Id ([int]$state.backendPid) -ErrorAction SilentlyContinue)
    $frontendAlive = [bool](Get-Process -Id ([int]$state.frontendPid) -ErrorAction SilentlyContinue)
    $backendPortOpen = Test-PortListening ([int]$state.backendPort)
    $frontendPortOpen = Test-PortListening ([int]$state.frontendPort)

    Write-Host ""
    Write-Host "Kompare dev stack" -ForegroundColor White
    Write-Host "  Root:        $($state.root)"
    Write-Host "  Backend:     $($state.backendUrl)  pid=$($state.backendPid) alive=$backendAlive port=$backendPortOpen"
    Write-Host "  Frontend:    $($state.frontendUrl)  pid=$($state.frontendPid) alive=$frontendAlive port=$frontendPortOpen"
    Write-Host "  API proxy:   $($state.apiProxyTarget)"
    Write-Host "  Started at:  $($state.startedAt)"
    if ($state.logs) {
        Write-Host "  Backend log: $($state.logs.backendErr)"
        Write-Host "  Frontend log:$($state.logs.frontendErr)"
    }
    else {
        Write-Host "  Logs:        $logDir"
    }
}

function Ensure-DotEnv {
    $envPath = Join-Path $root '.env'
    $examplePath = Join-Path $root '.env.example'

    if ((Test-Path $envPath) -or -not (Test-Path $examplePath)) { return }

    Copy-Item -LiteralPath $examplePath -Destination $envPath
    Write-Ok "Created .env from .env.example"
}

function Ensure-PythonDependencies {
    if ($NoInstall) { return }

    if (-not (Test-Command 'python')) {
        throw "python was not found on PATH. Install Python 3.11+ first, then run .\dev.ps1 again."
    }

    & python -c "import fastapi, uvicorn" 2>$null
    if ($LASTEXITCODE -eq 0) { return }

    Write-Step "Installing Python dependencies..."
    $install = Start-Process -PassThru -Wait -NoNewWindow `
        -FilePath python `
        -ArgumentList "-m", "pip", "install", "-r", "requirements.txt" `
        -WorkingDirectory $root

    if ($install.ExitCode -ne 0) {
        throw "Python dependency install failed with exit code $($install.ExitCode)."
    }
}

function Ensure-FrontendDependencies {
    if ($NoInstall) { return }

    if (-not (Test-Command 'npm')) {
        throw "npm was not found on PATH. Install Node.js first, then run .\dev.ps1 again."
    }

    $nextPackage = Join-Path $frontendDir 'node_modules\next\package.json'
    if (Test-Path $nextPackage) { return }

    $packageLock = Join-Path $frontendDir 'package-lock.json'
    $npmArgs = if (Test-Path $packageLock) { @('ci') } else { @('install') }

    Write-Step "Installing frontend dependencies with npm $($npmArgs -join ' ')..."
    $install = Start-Process -PassThru -Wait -NoNewWindow `
        -FilePath cmd.exe `
        -ArgumentList @('/c', "npm $($npmArgs -join ' ')") `
        -WorkingDirectory $frontendDir

    if ($install.ExitCode -ne 0) {
        throw "Frontend dependency install failed with exit code $($install.ExitCode)."
    }
}

function Tail-LogsUntilExit {
    param(
        [System.Diagnostics.Process]$BackendProcess,
        [System.Diagnostics.Process]$FrontendProcess,
        [string]$BackendLog,
        [string]$FrontendLog
    )

    $backendJob = $null
    $frontendJob = $null

    try {
        $backendJob = Start-Job -ArgumentList $BackendLog {
            param($Path)
            Get-Content -LiteralPath $Path -Wait -Tail 0 -ErrorAction SilentlyContinue
        }
        $frontendJob = Start-Job -ArgumentList $FrontendLog {
            param($Path)
            Get-Content -LiteralPath $Path -Wait -Tail 0 -ErrorAction SilentlyContinue
        }

        while ($BackendProcess.HasExited -eq $false -and $FrontendProcess.HasExited -eq $false) {
            Receive-Job $backendJob | ForEach-Object { Write-Host "[backend]  $_" -ForegroundColor DarkYellow }
            Receive-Job $frontendJob | ForEach-Object { Write-Host "[frontend] $_" -ForegroundColor DarkCyan }
            Start-Sleep -Milliseconds 500
        }
    }
    finally {
        if ($backendJob) { Stop-Job $backendJob -ErrorAction SilentlyContinue; Remove-Job $backendJob -ErrorAction SilentlyContinue }
        if ($frontendJob) { Stop-Job $frontendJob -ErrorAction SilentlyContinue; Remove-Job $frontendJob -ErrorAction SilentlyContinue }
    }
}

if ($Stop) {
    Stop-SavedServers
    return
}

if ($Status) {
    Show-Status
    return
}

Ensure-DotEnv
Ensure-PythonDependencies
Ensure-FrontendDependencies

$existingState = Read-State
if ($existingState) {
    Write-Step "Stopping previously saved Kompare dev servers..."
    Stop-ProcessTree -ProcessId ([int]$existingState.backendPid)
    Stop-ProcessTree -ProcessId ([int]$existingState.frontendPid)
    Remove-State
}

if (-not $NoCleanPorts) {
    Write-Step "Cleaning requested ports :$BackendPort and :$FrontendPort..."
    Stop-OnPort $BackendPort
    Stop-OnPort $FrontendPort
    Start-Sleep -Seconds 1
}
elseif ($CleanPorts) {
    Write-Warn "-CleanPorts is already the default. Remove -NoCleanPorts if you want ports cleaned."
}

$actualBackendPort = Get-AvailablePort $BackendPort
$actualFrontendPort = Get-AvailablePort $FrontendPort

if ($actualBackendPort -ne $BackendPort) {
    Write-Warn "Backend :$BackendPort is occupied. Using :$actualBackendPort."
}
if ($actualFrontendPort -ne $FrontendPort) {
    Write-Warn "Frontend :$FrontendPort is occupied. Using :$actualFrontendPort."
}

$script:sessionId = Get-Date -Format 'yyyyMMdd-HHmmss'
$backendOut = Join-Path $logDir "backend-$script:sessionId.out"
$backendErr = Join-Path $logDir "backend-$script:sessionId.err"
$frontendOut = Join-Path $logDir "frontend-$script:sessionId.out"
$frontendErr = Join-Path $logDir "frontend-$script:sessionId.err"

New-Item -ItemType File -Force -Path $backendOut | Out-Null
New-Item -ItemType File -Force -Path $backendErr | Out-Null
New-Item -ItemType File -Force -Path $frontendOut | Out-Null
New-Item -ItemType File -Force -Path $frontendErr | Out-Null

$proxyTarget = "http://127.0.0.1:$actualBackendPort"

Write-Step "Starting backend (FastAPI :$actualBackendPort)..."
$env:PYTHONPATH = $root
$backend = Start-Process -PassThru -WindowStyle Hidden `
    -FilePath python `
    -ArgumentList "-m", "uvicorn", "backend.app:app", "--reload", "--host", "127.0.0.1", "--port", "$actualBackendPort" `
    -WorkingDirectory $root `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr

Write-Step "Starting frontend (Next.js :$actualFrontendPort)..."
$frontendCommand = "set `"NEXT_PUBLIC_API_PROXY_TARGET=$proxyTarget`" && set `"NEXT_PUBLIC_API_BASE_URL=$proxyTarget`" && npm run dev -- --hostname 127.0.0.1 --port $actualFrontendPort"
$frontend = Start-Process -PassThru -WindowStyle Hidden `
    -FilePath cmd.exe `
    -ArgumentList "/c", "$frontendCommand > `"$frontendOut`" 2> `"$frontendErr`"" `
    -WorkingDirectory $frontendDir

Save-State `
    -BackendPid $backend.Id `
    -FrontendPid $frontend.Id `
    -BackendPort $actualBackendPort `
    -FrontendPort $actualFrontendPort

$backendReady = Wait-Port $actualBackendPort
$frontendReady = Wait-Port $actualFrontendPort

if (-not $backendReady) {
    Write-Fail "Backend failed to start. Tail of backend.err:"
    Get-Content -LiteralPath $backendErr -Tail 30 -ErrorAction SilentlyContinue
}

if (-not $frontendReady) {
    Write-Fail "Frontend failed to start. Tail of frontend.err:"
    Get-Content -LiteralPath $frontendErr -Tail 30 -ErrorAction SilentlyContinue
}

if (-not ($backendReady -and $frontendReady)) {
    Stop-ProcessTree -ProcessId $backend.Id
    Stop-ProcessTree -ProcessId $frontend.Id
    Remove-State
    exit 1
}

Write-Host ""
Write-Ok "Backend  -> http://127.0.0.1:$actualBackendPort  (docs at /docs)"
Write-Ok "Frontend -> http://127.0.0.1:$actualFrontendPort"
Write-Ok "API proxy -> $proxyTarget"
Write-Host ""
Write-Host "Logs:   $logDir" -ForegroundColor DarkGray
Write-Host "Status: .\dev.ps1 -Status" -ForegroundColor DarkGray
Write-Host "Stop:   .\dev.ps1 -Stop" -ForegroundColor DarkGray

if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:$actualFrontendPort"
}

if ($Detached) {
    Write-Host "Running detached. Use .\dev.ps1 -Stop when finished." -ForegroundColor DarkGray
    return
}

Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor DarkGray

try {
    Tail-LogsUntilExit `
        -BackendProcess $backend `
        -FrontendProcess $frontend `
        -BackendLog $backendErr `
        -FrontendLog $frontendErr
}
finally {
    Write-Host ""
    Write-Step "Stopping servers..."
    Stop-ProcessTree -ProcessId $backend.Id
    Stop-ProcessTree -ProcessId $frontend.Id
    Remove-State
    Write-Ok "Done."
}
