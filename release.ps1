param (
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [string]$Message
)

# Error handling
$ErrorActionPreference = "Stop"

try {
    # 0. Validate format (simple regex for x.y.z)
    if ($Version -notmatch "^\d+\.\d+\.\d+$") {
        Write-Error "Version format must be x.y.z (e.g. 0.4.1)"
        exit 1
    }

    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = "release: v$Version"
    }

    Write-Host "Starting Release Process for v$Version..." -ForegroundColor Cyan

    # 1. Update tauri.conf.json
    Write-Host "Updating tauri.conf.json..."
    $tauriPath = "src-tauri/tauri.conf.json"
    $content = Get-Content $tauriPath -Raw
    # Regex to replace version. Look for "version": "..."
    $newContent = $content -replace '"version": "\d+\.\d+\.\d+"', ('"version": "{0}"' -f $Version)
    Set-Content -Path $tauriPath -Value $newContent

    # 2. Update package.json (if exists, good practice)
    if (Test-Path "package.json") {
        Write-Host "Updating package.json..."
        $pkgContent = Get-Content "package.json" -Raw
        $newPkgContent = $pkgContent -replace '"version": "\d+\.\d+\.\d+"', ('"version": "{0}"' -f $Version)
        Set-Content -Path "package.json" -Value $newPkgContent
    }

    # 3. Generate Release Notes
    Write-Host "Generating Release Notes..."
    $lastTag = git describe --tags --abbrev=0 2>$null
    if (-not $lastTag) { $lastTag = "HEAD^" } # Fallback if no tags
    
    $commits = git log --pretty=format:"- %s" "$lastTag..HEAD"
    $cleanCommits = $commits | Where-Object { 
        $_ -notmatch "^chore" -and 
        $_ -notmatch "^release" -and 
        $_ -notmatch "^Merge"
    }

    $releaseNotes = "# Hotspot Manager v$Version`n`n## Yenilikler`n$($cleanCommits -join "`n")"
    
    # Add manual message if provided
    if ($Message -ne "release: v$Version") {
        $releaseNotes += "`n`n## Notlar`n- $Message"
    }

    Set-Content -Path "RELEASE_NOTES.md" -Value $releaseNotes -Encoding UTF8
    Write-Host "   -> RELEASE_NOTES.md created."

    # 4. Git Operations
    Write-Host "Staging changes..."
    git add .

    Write-Host "Committing..."
    git commit -m "release: v$Version"

    Write-Host "Tagging v$Version..."
    git tag -f "v$Version"

    Write-Host "Pushing to GitHub..."
    git push origin main
    git push origin "v$Version"

    Write-Host "Release v$Version pushed successfully! Workflow should trigger now." -ForegroundColor Green

} catch {
    Write-Error "An error occurred: $_"
    exit 1
}
