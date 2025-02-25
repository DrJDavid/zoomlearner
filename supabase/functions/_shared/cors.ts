// CORS headers for all edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Handle CORS preflight requests
export function handleCors(req: Request): Response | null {
  // Handle OPTIONS request (preflight request)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Return null for the actual request to continue processing
  return null;
}

// Add CORS headers to any response
export function addCorsHeaders(response: Response): Response {
  // Create a new response with the same body but with CORS headers added
  const newHeaders = new Headers(response.headers);
  Object.keys(corsHeaders).forEach(key => {
    newHeaders.set(key, corsHeaders[key]);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
} 