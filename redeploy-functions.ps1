# PowerShell script to deploy all Supabase edge functions
Write-Output "Redeploying Supabase Edge Functions..."

# Change to the supabase directory
Set-Location -Path ./supabase

# Deploy each function individually and wait for completion
Write-Output "`nDeploying gemini-chat..."
npx supabase functions deploy gemini-chat
if ($LASTEXITCODE -ne 0) {
    Write-Output "Error deploying gemini-chat. Please check the logs."
    exit $LASTEXITCODE
}

Write-Output "`nDeploying gemini-summary..."
npx supabase functions deploy gemini-summary
if ($LASTEXITCODE -ne 0) {
    Write-Output "Error deploying gemini-summary. Please check the logs."
    exit $LASTEXITCODE
}

Write-Output "`nDeploying gemini-quiz-generator..."
npx supabase functions deploy gemini-quiz-generator
if ($LASTEXITCODE -ne 0) {
    Write-Output "Error deploying gemini-quiz-generator. Please check the logs."
    exit $LASTEXITCODE
}

Write-Output "`nAll functions redeployed successfully!"
Write-Output "AI features should now work correctly with CORS enabled."

# Return to the original directory
Set-Location -Path ..

Write-Output "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 