$ErrorActionPreference = 'Stop'
$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$sourceFolder = Join-Path $workspaceRoot 'disaster-casualty-system/output/docx'
$renderFolder = Join-Path $PSScriptRoot 'word-render'
[System.IO.Directory]::CreateDirectory($renderFolder) | Out-Null
$wordRenderer = $null
try {
    $wordRenderer = New-Object -ComObject Word.Application
    $wordRenderer.Visible = $false
    $wordRenderer.DisplayAlerts = 0
    foreach ($documentName in @('SCRIBER-System-Architecture', 'SCRIBER-Database-Schema', 'SCRIBER-Wireframes')) {
        $sourceFile = Join-Path $sourceFolder ($documentName + '.docx')
        $pdfFile = Join-Path $renderFolder ($documentName + '.pdf')
        $renderDocument = $null
        try {
            $renderDocument = $wordRenderer.Documents.Open($sourceFile, $false, $true, $false)
            $renderDocument.Repaginate()
            $pageCount = $renderDocument.ComputeStatistics(2)
            $renderDocument.ExportAsFixedFormat($pdfFile, 17)
            Write-Output ($documentName + ': ' + $pageCount + ' pages')
        } finally {
            if ($null -ne $renderDocument) {
                $renderDocument.Close(0)
                [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($renderDocument) | Out-Null
            }
        }
    }
} finally {
    if ($null -ne $wordRenderer) {
        $wordRenderer.Quit(0)
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordRenderer) | Out-Null
    }
}
