# Run in Windows PowerShell as the current user (no admin required).
# Prerequisite: Python 3.12 available via "py -3".
$ErrorActionPreference = "Stop"
$root = "D:\PinkLive"
New-Item -ItemType Directory -Force -Path $root | Out-Null
$repo = "https://raw.githubusercontent.com/my283104/pink-live-assistant/feature/supabase-sync/sync-server"
$script = Join-Path $root "cloud_pull.py"
Invoke-WebRequest -Uri "$repo/cloud_pull.py" -OutFile $script
Write-Host "First login to your cloud account (password is encrypted with Windows DPAPI)."
& py -3 $script --login
if ($LASTEXITCODE -ne 0) { throw "Cloud login failed" }
& py -3 $script
if ($LASTEXITCODE -ne 0) { throw "Initial pull failed" }
$taskName = "PinkLive Cloud Pull"
$python = (& py -3 -c "import sys;print(sys.executable)").Trim()
$action = New-ScheduledTaskAction -Execute $python -Argument ('"' + $script + '"') -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Write-Host "Ready. Sync runs every 15 minutes while this Windows user is logged in."
