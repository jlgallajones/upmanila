[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$LogDirectory = Join-Path $Root "output\verification"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $LogDirectory "verification-$Timestamp.log"
$LatestLogPath = Join-Path $LogDirectory "verification-latest.log"
$SummaryPath = Join-Path $LogDirectory "verification-$Timestamp.json"
$LatestSummaryPath = Join-Path $LogDirectory "verification-latest.json"

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
New-Item -ItemType File -Path $LogPath -Force | Out-Null

$results = [System.Collections.Generic.List[object]]::new()

function Write-EvidenceLine {
    param([string]$Message)
    Add-Content -LiteralPath $LogPath -Value $Message
}

function Invoke-VerificationStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    $started = Get-Date
    Write-Host ("[{0:00}/{1:00}] {2} ..." -f ($results.Count + 1), $TotalChecks, $Name) -NoNewline -ForegroundColor DarkCyan
    Write-EvidenceLine "[RUN ] $Name"
    Write-EvidenceLine "       Directory: $WorkingDirectory"
    Write-EvidenceLine "       Command: $Command $($Arguments -join ' ')"

    Push-Location $WorkingDirectory
    try {
        $commandOutput = @(& $Command @Arguments 2>&1)
        $commandOutput | ForEach-Object { $_.ToString() | Add-Content -LiteralPath $LogPath }
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    } catch {
        $exitCode = 1
        $errorLine = "Exception: $($_.Exception.Message)"
        Write-EvidenceLine $errorLine
    } finally {
        Pop-Location
    }

    $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    $finished = Get-Date
    $results.Add([pscustomobject]@{
        test = $Name
        result = $status
        exitCode = $exitCode
        started = $started.ToString("o")
        finished = $finished.ToString("o")
        evidence = $LogPath
    })

    $color = if ($status -eq "PASS") { "Green" } else { "Red" }
    $symbol = if ($status -eq "PASS") { [char]0x2713 } else { [char]0x2717 }
    Write-Host ("`r[{0:00}/{1:00}] {2} ... {3} {4}" -f ($results.Count), $TotalChecks, $Name, $symbol, $status) -ForegroundColor $color
    Write-EvidenceLine "[$status] $Name (exit code $exitCode)"
}

Write-EvidenceLine "DCMS VERIFICATION RUN"
Write-EvidenceLine "Started: $(Get-Date -Format o)"
Write-EvidenceLine "Root: $Root"

$api = Join-Path $Root "api"
$mobile = Join-Path $Root "mobile"
$website = Join-Path $Root "website"
$TotalChecks = 10

Invoke-VerificationStep "API TypeScript typecheck" $api "npm.cmd" @("run", "typecheck")
Invoke-VerificationStep "API production build" $api "npm.cmd" @("run", "build")
Invoke-VerificationStep "Incident analytics tests" $api "npm.cmd" @("run", "test:analytics")
Invoke-VerificationStep "Triage calculation and accuracy tests" $api "npm.cmd" @("run", "test:triage")
Invoke-VerificationStep "Mobile TypeScript typecheck" $mobile "npm.cmd" @("exec", "tsc", "--", "--noEmit")
Invoke-VerificationStep "Mobile/PWA web export" $mobile "npm.cmd" @("run", "build:web")
Invoke-VerificationStep "Web dashboard syntax check" $website "node.exe" @("--check", "app.js")
Invoke-VerificationStep "Web configuration syntax check" $website "node.exe" @("--check", "config.js")
Invoke-VerificationStep "PWA service worker syntax check" $mobile "node.exe" @("--check", "public/sw.js")
Invoke-VerificationStep "Repository whitespace check" $Root "git.exe" @("diff", "--check")

$passed = @($results | Where-Object { $_.result -eq "PASS" }).Count
$failed = @($results | Where-Object { $_.result -eq "FAIL" }).Count
$summary = [pscustomobject]@{
    project = "Disaster Casualty Management System"
    started = $results[0].started
    finished = (Get-Date).ToString("o")
    total = $results.Count
    passed = $passed
    failed = $failed
    log = $LogPath
    tests = @($results)
}

$summaryJson = $summary | ConvertTo-Json -Depth 6
$summaryJson | Set-Content -LiteralPath $SummaryPath -Encoding UTF8
$summaryJson | Set-Content -LiteralPath $LatestSummaryPath -Encoding UTF8
Copy-Item -LiteralPath $LogPath -Destination $LatestLogPath -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "DCMS VERIFICATION SUMMARY" -ForegroundColor White
Write-Host "Passed: $passed / $($results.Count)" -ForegroundColor Green
Write-Host "Failed: $failed / $($results.Count)" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "Log: $LogPath" -ForegroundColor Yellow
Write-Host "Summary: $SummaryPath" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor White

if ($failed -gt 0) {
    exit 1
}

exit 0
