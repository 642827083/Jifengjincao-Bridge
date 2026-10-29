param([Parameter(Mandatory=$true)][string]$PackagePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
try {
    $entries = @{}
    foreach ($entry in $archive.Entries) {
        $entryName = $entry.FullName.Replace('\', '/')
        if ($entryName.EndsWith('/')) { continue }
        if ($entryName.Contains('..') -or $entryName.StartsWith('/') -or $entries.ContainsKey($entryName)) { throw "Invalid or duplicate archive path: $entryName" }
        $entries[$entryName] = $entry
    }
    function Read-EntryText([string]$EntryName) {
        if (-not $entries.ContainsKey($EntryName)) { throw "Missing resource: $EntryName" }
        $reader = [System.IO.StreamReader]::new($entries[$EntryName].Open())
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    $manifest = (Read-EntryText 'build-manifest.json') | ConvertFrom-Json
    $sourceMetadata = Get-Content -LiteralPath (Join-Path $projectRoot 'src/mnaddon.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $packedMetadata = (Read-EntryText 'mnaddon.json') | ConvertFrom-Json
    if ($manifest.title -ne 'Jifengjincao Bridge' -or $manifest.version -ne $sourceMetadata.version -or $packedMetadata.addonid -ne $sourceMetadata.addonid) { throw 'Archive identity or version mismatch' }
    $resourceNames = @($manifest.files.PSObject.Properties.Name)
    if ($entries.Count -ne $resourceNames.Count + 1) { throw 'Archive file count does not match manifest' }
    foreach ($resourceName in $resourceNames) {
        if (-not $entries.ContainsKey($resourceName)) { throw "Missing resource: $resourceName" }
        $stream = $entries[$resourceName].Open()
        $hasher = [System.Security.Cryptography.SHA256]::Create()
        try { $digest = ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
        finally { $stream.Dispose(); $hasher.Dispose() }
        $sourceStream = [System.IO.File]::OpenRead((Join-Path $projectRoot ('src/' + $resourceName)))
        $sourceHasher = [System.Security.Cryptography.SHA256]::Create()
        try { $sourceDigest = ([BitConverter]::ToString($sourceHasher.ComputeHash($sourceStream))).Replace('-', '').ToLowerInvariant() }
        finally { $sourceStream.Dispose(); $sourceHasher.Dispose() }
        if ($digest -ne $manifest.files.$resourceName -or $digest -ne $sourceDigest) { throw "Resource hash does not match source: $resourceName" }
    }
    $main = Read-EntryText 'main.js'
    $dependencies = [regex]::Matches($main, 'JSB\.require\([''"]([^''"]+)[''"]\)')
    if ($dependencies.Count -eq 0) { throw 'No entry dependencies found' }
    foreach ($match in $dependencies) {
        $dependency = $match.Groups[1].Value
        if (-not $dependency.EndsWith('.js')) { $dependency += '.js' }
        if (-not $entries.ContainsKey($dependency)) { throw "Missing entry dependency: $dependency" }
    }
    $pageSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanPage.js') -Raw -Encoding UTF8
    $selectionSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanSelection.js') -Raw -Encoding UTF8
    $headerSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanHeader.js') -Raw -Encoding UTF8
    $layoutSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanLayout.js') -Raw -Encoding UTF8
    $reviewSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanReview.js') -Raw -Encoding UTF8
    $questionToolsSource = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanQuestionTools.js') -Raw -Encoding UTF8
    $embedded = Read-EntryText 'web-dist/BBKaoyanPageScript.js'
    $embeddedSource = ($embedded -replace '^var __JFJC_PAGE_SCRIPT__ = ', '' -replace ';\s*$', '') | ConvertFrom-Json
    $dialogStyle = Get-Content -LiteralPath (Join-Path $projectRoot 'src/web-dist/BBKaoyanDialogStyle.js') -Raw -Encoding UTF8
    $styleSource = ($dialogStyle -replace '^window\.__JFJC_DIALOG_CSS__ = ', '' -replace ';\s*$', '') | ConvertFrom-Json
    $sourceCss = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/BBKaoyanDialog.css') -Raw -Encoding UTF8
    if ($styleSource -cne $sourceCss) { throw 'Dialog style does not match web source' }
    if ($embeddedSource -cne ($dialogStyle + "`n" + $headerSource + "`n" + $layoutSource + "`n" + $selectionSource + "`n" + $pageSource + "`n" + $reviewSource + "`n" + $questionToolsSource)) { throw 'Embedded script does not match web source' }
    $webResources = @($resourceNames | Where-Object { $_.StartsWith('web-dist/') })
    if ($webResources.Count -ne 3 -or $webResources -notcontains 'web-dist/BBKaoyanPageScript.js' -or $webResources -notcontains 'web-dist/ImportPageResource.js' -or $webResources -notcontains 'web-dist/HandwritingPage.html') { throw 'Unexpected web resources in package' }
    $inkHtml = Read-EntryText 'web-dist/HandwritingPage.html'
    if ($packedMetadata.panel -cne 'web-dist/HandwritingPage.html') { throw 'Official handwriting panel is not declared' }
    $inkBridge = (Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/lib/mnBridge.js') -Raw -Encoding UTF8).Replace('export default MNBridge;', '')
    $inkScript = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/HandwritingPage.js') -Raw -Encoding UTF8
    if ($inkHtml -cne ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p id="status" style="font:14px system-ui;padding:12px">正在读取所选卡片手写…</p><script>' + $inkBridge + "`n" + $inkScript + '</script></body></html>')) { throw 'Handwriting helper does not match web source' }
    $importResource = Read-EntryText 'web-dist/ImportPageResource.js'
    $importHtml = ($importResource -replace '^var __JFJC_IMPORT_HTML__ = ', '' -replace ';\s*$', '') | ConvertFrom-Json
    $importTemplate = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/ImportPage.html') -Raw -Encoding UTF8
    $importCss = Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/ImportPage.css') -Raw -Encoding UTF8
    $importBridge = (Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/lib/mnBridge.js') -Raw -Encoding UTF8).Replace('export default MNBridge;', '')
    $importScript = (Get-Content -LiteralPath (Join-Path $projectRoot 'web/src/ImportPage.mjs') -Raw -Encoding UTF8).Replace("import MNBridge from './lib/mnBridge.js';", '')
    if ($importHtml -cne $importTemplate.Replace('/* 导入样式 */', $importCss).Replace('/* 导入脚本 */', ($importBridge + "`n" + $importScript))) { throw 'Import page does not match web source' }
    if ($embeddedSource.Contains('__JFJC_MATH__') -or $embeddedSource.Contains('__JFJC_PREVIEW__') -or $embeddedSource.Contains('data:font/woff2;base64,')) { throw 'Removed formula preview remains in bundle' }
    Write-Output "Archive verified: $($resourceNames.Count) resources, entry dependencies, SHA256 and web source match"
} finally { $archive.Dispose() }
