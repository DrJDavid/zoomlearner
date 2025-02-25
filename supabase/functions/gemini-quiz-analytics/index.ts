// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Follow Deno runtime's permissions requirements
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { corsHeaders, handleCors, addCorsHeaders } from "../_shared/cors.ts";

console.log("Quiz Analytics Function Started!")

serve(async (req) => {
  try {
    // Handle CORS if needed
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Parse the request body
    const { p_quiz_session_id } = await req.json();

    // Validation
    if (!p_quiz_session_id) {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing quiz_session_id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Get Supabase client
    const supabaseClient = Deno.env.get("SUPABASE_CLIENT") !== "service_role" 
      ? "service_role" 
      : Deno.env.get("SUPABASE_CLIENT") || "anon";
    
    const supabase = Deno.createClient(supabaseClient);

    // First, get the quiz session details
    const { data: quizSession, error: quizError } = await supabase
      .from('quiz_sessions')
      .select('score, reading_session_id, created_at, updated_at')
      .eq('id', p_quiz_session_id)
      .single();
    
    if (quizError) {
      console.error("Error fetching quiz session:", quizError);
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Failed to fetch quiz session details" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }
    
    // Get reading session details
    const { data: readingSession, error: readingError } = await supabase
      .from('reading_sessions')
      .select('document_id, words_read, total_words, average_speed')
      .eq('id', quizSession.reading_session_id)
      .single();
    
    if (readingError) {
      console.error("Error fetching reading session:", readingError);
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Failed to fetch reading metrics" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }
    
    // Get total questions count
    const { count: totalQuestions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_session_id', p_quiz_session_id);
    
    if (questionsError) {
      console.error("Error counting quiz questions:", questionsError);
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Failed to count quiz questions" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }
    
    // Prepare the analytics data with proper null handling
    const wordsRead = readingSession.words_read || 0;
    const totalWords = readingSession.total_words || 100; // default to 100 if missing
    const readingPositionPercent = totalWords > 0 
      ? (wordsRead / totalWords) * 100 
      : 0;
    
    const scorePercentage = totalQuestions > 0 && quizSession.score != null
      ? (quizSession.score / totalQuestions) * 100
      : 0;
    
    const analyticsData = {
      readingSessionId: quizSession.reading_session_id,
      documentId: readingSession.document_id,
      wordsRead: wordsRead,
      totalWords: totalWords,
      readingPositionPercent: readingPositionPercent,
      averageSpeed: readingSession.average_speed || 250, // default to 250 wpm if missing
      quizSessionId: p_quiz_session_id,
      quizScore: quizSession.score || 0,
      totalQuestions: totalQuestions || 0,
      scorePercentage: scorePercentage,
      quizCreatedAt: quizSession.created_at,
      quizCompletedAt: quizSession.updated_at
    };
    
    console.log("Analytics data prepared:", analyticsData);
    
    // Return the analytics data
    return addCorsHeaders(new Response(
      JSON.stringify({ analytics: analyticsData }),
      { headers: { "Content-Type": "application/json" } }
    ));
  } catch (error) {
    console.error("Error in quiz analytics function:", error);
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-quiz-analytics' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"p_quiz_session_id": "your-quiz-session-id"}'

*/ 