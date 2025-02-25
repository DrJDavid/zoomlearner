// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Follow Deno runtime's permissions requirements
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { corsHeaders, handleCors, addCorsHeaders } from "../_shared/cors.ts";

console.log("Quiz Answer Function Started!")

serve(async (req) => {
  try {
    // Handle CORS if needed
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Parse the request body
    const { p_question_id, p_selected_option } = await req.json();

    // Validation
    if (!p_question_id) {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing question_id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    if (p_selected_option === undefined || p_selected_option === null) {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing selected_option parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Get Supabase client
    const supabaseClient = Deno.env.get("SUPABASE_CLIENT") !== "service_role" 
      ? "service_role" 
      : Deno.env.get("SUPABASE_CLIENT") || "anon";
    
    const supabase = Deno.createClient(supabaseClient);

    // Submit the answer using the database function
    const { data, error } = await supabase.rpc('submit_quiz_answer_v2', {
      p_question_id,
      p_selected_option
    });

    if (error) {
      console.error("Error submitting quiz answer:", error);
      return addCorsHeaders(new Response(
        JSON.stringify({ 
          error: "Failed to submit quiz answer",
          details: error.message 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }
    
    // Return success response
    return addCorsHeaders(new Response(
      JSON.stringify({ 
        success: true,
        is_correct: data // The function returns whether the answer was correct
      }),
      { headers: { "Content-Type": "application/json" } }
    ));
  } catch (error) {
    console.error("Error in quiz answer function:", error);
    // Return error WITH CORS headers
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-quiz-answer' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"p_question_id": "your-question-id", "p_selected_option": 0}'

*/ 