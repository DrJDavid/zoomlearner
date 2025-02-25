# Fixing AI Functionality Issues

Follow these steps to fix the AI functionality in your application:

## 1. Apply HTTP Extension Fix

First, we need to properly set up the PostgreSQL HTTP extension which is required by your database functions:

1. Apply the new migration file `00_setup_http_extension.sql` first:

```bash
cd supabase
npx supabase db push --db-url=<your-db-url> migrationsnew/00_setup_http_extension.sql
```

## 2. Verify Edge Functions

Make sure your edge functions are properly deployed:

```bash
cd supabase
npx supabase functions deploy gemini-chat
npx supabase functions deploy gemini-summary
npx supabase functions deploy gemini-quiz-generator
```

## 3. Verify Environment Variables

Ensure the `GEMINI_API_KEY` is properly set in your edge functions:

```bash
cd supabase
npx supabase secrets list
```

If GEMINI_API_KEY is not present, set it:

```bash
npx supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

## 4. Test the Functionality

After making these changes:

1. The "Schema 'http' doesn't exist" error should be resolved by the new migration that properly sets up the HTTP extension
2. The CORS issues should be resolved as the edge functions already have proper CORS handling
3. We've modified the AI client code to use the edge functions directly instead of going through database RPC functions

## Troubleshooting

If you're still experiencing issues:

1. Check the browser console for more specific error messages
2. Verify the network requests in your browser's Network tab to see what responses you're getting from the edge functions
3. Make sure your Supabase URL and API key are correctly configured in your client application 