// Using Vercel Edge Functions for potential speed and cost benefits
// See: https://vercel.com/docs/functions/edge-functions
export const config = {
  runtime: 'edge',
};

// Simple POST handler for chat requests
export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { message } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Read generic LLM configuration from environment variables
    const apiUrl = process.env.VITE_LLM_API_URL;
    const apiKey = process.env.VITE_LLM_API_KEY;
    const authSchema = process.env.VITE_LLM_AUTH_SCHEMA || 'Bearer'; // Default to Bearer
    const modelName = process.env.VITE_LLM_MODEL || 'default-model'; // Provide a default or make it mandatory

    if (!apiUrl || !apiKey) {
      console.error('VITE_LLM_API_URL or VITE_LLM_API_KEY is not set in environment variables.');
      return new Response(JSON.stringify({ error: 'LLM API URL or Key not configured on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Call Generic LLM API ---
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Construct Authorization header based on schema
    if (authSchema.toLowerCase() === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (authSchema.toLowerCase() === 'apikey') { // Example for a different schema
      headers['X-API-Key'] = apiKey; // Adjust header name as needed
    } else if (authSchema.toLowerCase() !== 'none') {
      // Handle other potential schemas or custom headers if necessary
      // For simplicity, we assume Bearer or ApiKey or None for now
      headers['Authorization'] = `${authSchema} ${apiKey}`;
    }
    // If authSchema is 'none', no Authorization header is added.

    // Define a default request body structure (similar to OpenAI)
    // This might need adjustment based on the specific LLM service used
    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant embedded in a robot simulator.' },
        { role: 'user', content: message },
      ],
      // Common parameters (optional, adjust as needed)
      // temperature: 0.7,
      // max_tokens: 150,
    };

    // Note: For Gemini, the URL often includes the API key and the body structure is different.
    // This generic approach works best for APIs following the OpenAI structure.
    // Adapting to vastly different APIs might require conditional logic based on the URL or another env var.

    const llmResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!llmResponse.ok) {
      let errorDetails = 'Unknown error';
      try {
        errorDetails = await llmResponse.json();
      } catch (e) { /* Ignore parsing error */ }
      console.error('LLM API Error:', llmResponse.status, errorDetails);
      return new Response(JSON.stringify({ error: `Failed to get response from LLM Service (${llmResponse.status})`, details: errorDetails }), {
        status: llmResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await llmResponse.json();
    // Attempt to extract reply based on common structures (OpenAI-like first)
    let botReply = data.choices?.[0]?.message?.content?.trim();

    // Add fallback for Gemini-like structure if the first fails
    if (!botReply) {
      botReply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    }

    botReply = botReply || 'Sorry, I could not parse the response.';
    // --- End Generic LLM API Call ---

    return new Response(JSON.stringify({ reply: botReply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) { // Add type 'any' to access error properties
    // Log more detailed error information
    console.error('Error processing chat request in catch block:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Cause:', error.cause); // Often contains the underlying network error
    console.error('Error Stack:', error.stack);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { // Include error message in response
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}