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
    const { prompt, systemPrompt, documentContext, model = "gemini-2.0-flash-001" } = await req.json();

    // Validation
    if (!prompt || typeof prompt !== "string") {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing or invalid 'prompt' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Construct the prompt with system prompt and document context if available
    let fullPrompt = prompt;
    let fullSystemPrompt = systemPrompt || "You are a helpful assistant.";

    if (documentContext && typeof documentContext === "string") {
      fullSystemPrompt += `\n\nThe following is relevant content from the document to reference in your responses:
      
"""
${documentContext}
"""

Based on ONLY the information provided above, answer the user's question. If you cannot answer based on the provided content, say so clearly.`;
    }

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
              text: fullSystemPrompt ? `${fullSystemPrompt}\n\n${fullPrompt}` : fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            topP: 1
          }
        })
      }
    );

    // Parse the response
    const result = await response.json();
    console.log("Gemini API response:", JSON.stringify(result));

    // Extract the generated text
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error("Failed to get valid response from Gemini API:", result);
      return addCorsHeaders(new Response(
        JSON.stringify({ 
          error: "Failed to get valid response from Gemini API",
          details: result 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Return the successful response WITH CORS headers
    return addCorsHeaders(new Response(
      JSON.stringify({ text: generatedText }),
      { headers: { "Content-Type": "application/json" } }
    ));
  } catch (error) {
    console.error("Error in gemini-chat function:", error);
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-chat' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
