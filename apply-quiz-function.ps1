Write-Host "Applying new quiz function migration..." -ForegroundColor Green
cd supabase

# Apply the new migration
Write-Host "Running database push for add_quiz_question function..." -ForegroundColor Cyan
npx supabase db push "../migrationsnew/19_add_quiz_question_function.sql"

Write-Host "Migration complete!" -ForegroundColor Green
Write-Host "The missing 'add_quiz_question' function has been added to your database." -ForegroundColor Yellow

# Pause to view results
pause 