// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Follow Deno runtime's permissions requirements
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { corsHeaders, handleCors, addCorsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const API_URL = "https://generativelanguage.googleapis.com/v1beta";

console.log("Hello from Functions!")

serve(async (req) => {
  try {
    // Handle CORS if needed
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    if (!GEMINI_API_KEY) {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "API key not found. Set GEMINI_API_KEY in environment variables." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Parse the request body
    const { 
      content, 
      length = "medium", // "short", "medium", "long"
      model = "gemini-2.0-flash-001" 
    } = await req.json();

    // Validation
    if (!content || typeof content !== "string") {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing or invalid 'content' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Set length description based on parameter
    let lengthDesc;
    let maxTokens;
    switch (length) {
      case "short":
        lengthDesc = "a concise 2-3 sentence summary";
        maxTokens = 100;
        break;
      case "long":
        lengthDesc = "a detailed summary covering all key points (about 500-700 words)";
        maxTokens = 1500;
        break;
      default: // medium
        lengthDesc = "a balanced summary of about 250-350 words";
        maxTokens = 800;
    }

    // Construct system prompt
    const systemPrompt = `You are a skilled summarizer. Given a document or text, create ${lengthDesc} that captures the main ideas and important details.`;

    // Construct user prompt
    const userPrompt = `Please summarize the following text:

"""
${content}
"""`;

    // Call Gemini API
    const response = await fetch(
      `${API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.4, // Lower temperature for more factual output
            maxOutputTokens: maxTokens,
            topP: 1
          }
        })
      }
    );

    // Parse the response
    const result = await response.json();
    console.log("Gemini API summary response:", JSON.stringify(result));

    // Extract the generated summary
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      console.error("Failed to get valid summary from Gemini API:", result);
      return addCorsHeaders(new Response(
        JSON.stringify({ 
          error: "Failed to get valid summary from Gemini API",
          details: result 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Return the successful response WITH CORS headers
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        summary: summary,
        length: length 
      }),
      { headers: { "Content-Type": "application/json" } }
    ));
  } catch (error) {
    console.error("Error in gemini-summary function:", error);
    // Return error response WITH CORS headers
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        error: error.message, 
        stack: error.stack 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    ));
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-summary' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
