@echo off
echo Redeploying Supabase Edge Functions...

cd supabase

echo Deploying gemini-chat...
npx supabase functions deploy gemini-chat

echo Deploying gemini-summary...
npx supabase functions deploy gemini-summary

echo Deploying gemini-quiz-generator...
npx supabase functions deploy gemini-quiz-generator

echo All functions redeployed!
echo Now your AI features should work correctly.
pause 