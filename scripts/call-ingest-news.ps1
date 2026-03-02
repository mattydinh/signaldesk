# Call ingest-news and show full response.
# Usage (one line): .\scripts\call-ingest-news.ps1 "YOUR_CRON_SECRET"
param([Parameter(Position=0)] $Secret = $env:CRON_SECRET)
if (-not $Secret) {
  Write-Host "Usage: .\scripts\call-ingest-news.ps1 `"YOUR_CRON_SECRET`""
  exit 1
}
$secret = $Secret
$url = "https://signaldesk-chi.vercel.app/api/cron/ingest-news"
$headers = @{ Authorization = "Bearer $secret" }
try {
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
  $r | ConvertTo-Json -Depth 5
} catch {
  Write-Host "Status:" $_.Exception.Response.StatusCode
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  Write-Host $reader.ReadToEnd()
}
