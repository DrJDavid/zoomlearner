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

// Call Gemini API with a timeout to prevent hanging
const callGeminiWithTimeout = async (url: string, requestData: any, timeoutMs = 25000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
};

// Truncate content to a reasonable size
const truncateContent = (content: string, maxLength = 6000) => {
  if (content.length <= maxLength) return content;
  
  console.log(`Truncating content from ${content.length} to ${maxLength} characters`);
  
  // Find the last complete sentence within the limit
  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  
  if (lastPeriod > maxLength * 0.8) { // Only use period-based truncation if we're not losing too much content
    return truncated.substring(0, lastPeriod + 1) + '...';
  }
  
  return truncated + '...';
};

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
      numQuestions = 5,
      difficulty = "medium", // "easy", "medium", "hard"
      model = "gemini-2.0-flash-001"
    } = await req.json();

    // Validation
    if (!content || typeof content !== "string") {
      return addCorsHeaders(new Response(
        JSON.stringify({ error: "Missing or invalid 'content' parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      ));
    }

    // Set difficulty description
    let difficultyDesc = "moderately challenging questions that require good understanding of the content";
    if (difficulty === "easy") {
      difficultyDesc = "basic recall and simple understanding questions";
    } else if (difficulty === "hard") {
      difficultyDesc = "challenging questions that test deep understanding and critical thinking";
    }

    // Create system prompt
    const systemPrompt = "You are an expert educator who creates excellent quiz questions. Format your response as JSON only.";

    // Create user prompt
    const userPrompt = `Based on the following text, create ${numQuestions} ${difficultyDesc}. 

The questions should be multiple-choice with 4 options each. Make sure only one option is correct.

Text to create questions from:
"""
CONTENT_PLACEHOLDER
"""

Return ONLY a JSON array of question objects with this exact format:
[
  {
    "question": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option": 0  // Index of correct option (0-3)
  }
  // more questions...
]
Include nothing else in your response, just the valid JSON.`;

    // Call Gemini API
    try {
      console.log(`Generating quiz with ${content.length} character content`);
      
      // Truncate content to prevent timeouts
      const processedContent = truncateContent(content);
      console.log(`Using ${processedContent.length} characters for quiz generation`);
      
      const requestData = {
        contents: [{
          role: "user",
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt.replace('CONTENT_PLACEHOLDER', processedContent)}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          topP: 1
        }
      };
      
      const result = await callGeminiWithTimeout(
        `${API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        requestData
      );
      
      console.log("Gemini API quiz response received");

      // Extract the generated text
      let responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        console.error("Failed to get valid response from Gemini API:", result);
        return addCorsHeaders(new Response(
          JSON.stringify({
            error: "Failed to get valid response from Gemini API",
            details: result
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }

      // Clean up the response - sometimes AI adds extra text around the JSON
      try {
        // Extract just the JSON part (everything between the first '[' and last ']')
        const jsonStartIndex = responseText.indexOf('[');
        const jsonEndIndex = responseText.lastIndexOf(']') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          responseText = responseText.substring(jsonStartIndex, jsonEndIndex);
        }

        // Parse the JSON
        const questions = JSON.parse(responseText);

        // Validate questions format
        const isValidFormat = questions.every((q: any) => 
          typeof q.question === 'string' && 
          Array.isArray(q.options) && 
          q.options.length === 4 &&
          typeof q.correct_option === 'number' && 
          q.correct_option >= 0 && 
          q.correct_option < 4
        );

        if (!isValidFormat) {
          throw new Error("Generated questions don't follow the required format");
        }

        // Return the questions WITH CORS headers
        return addCorsHeaders(new Response(
          JSON.stringify({ questions }),
          { headers: { "Content-Type": "application/json" } }
        ));
      } catch (parseError) {
        console.error("Error parsing quiz questions:", parseError, "Raw response:", responseText);
        
        return addCorsHeaders(new Response(
          JSON.stringify({
            error: "Failed to parse quiz questions from API response",
            parseError: parseError.message,
            rawResponse: responseText
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
    } catch (error) {
      console.error("Error in gemini-quiz-generator function:", error);
      // Return error WITH CORS headers
      return addCorsHeaders(new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ));
    }
  } catch (error) {
    console.error("Error in gemini-quiz-generator function:", error);
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-quiz-generator' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
