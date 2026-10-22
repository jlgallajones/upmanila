$ErrorActionPreference = 'Stop'
$sourceFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../output/docx/SCRIBER-Defect-and-Resolution-Report.docx'))
$pdfFile = Join-Path $PSScriptRoot 'SCRIBER-Defect-and-Resolution-Report.pdf'
$stageLog = Join-Path $PSScriptRoot 'word-conversion.log'
$renderer = $null
$document = $null
function Stage([string]$message) { Add-Content -LiteralPath $stageLog -Value $message }
try {
    Stage 'Starting isolated Word conversion'
    $renderer = New-Object -ComObject Word.Application
    Stage 'Word application created'
    $renderer.Visible = $false
    $renderer.DisplayAlerts = 0
    $renderer.AutomationSecurity = 3
    $renderer.Options.UpdateLinksAtOpen = $false
    $renderer.Options.SaveNormalPrompt = $false
    Stage 'Opening read only document'
    $document = $renderer.Documents.Open($sourceFile, $false, $true, $false)
    Stage 'Document opened'
    $document.ExportAsFixedFormat($pdfFile, 17)
    Stage 'PDF exported'
} finally {
    if ($null -ne $document) { $document.Close(0) }
    if ($null -ne $renderer) { $renderer.Quit(0) }
}
