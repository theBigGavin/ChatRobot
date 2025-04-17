import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import path from 'path'; // Import path using ES module syntax
import { fileURLToPath } from 'url'; // Helper to get __dirname in ES modules

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Use imported path

const API_URL = process.env.LLM_API_URL;
const API_KEY = process.env.LLM_API_KEY;
const MODEL_NAME = process.env.LLM_MODEL_NAME; // Get model name from env

// Define the structure for messages sent to the AI service
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Define the expected structure of the successful API response (adjust if needed)
interface AISuccessResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  // Add other potential fields like usage, id, etc. if needed
}

// Define the structure of the API error response (adjust if needed)
interface AIErrorResponse {
  error?: {
    message?: string;
    type?: string;
    param?: string | null;
    code?: string | null;
  };
}

// Define a type for the request body sent to the AI service
interface AIRequestBody {
  messages: AIMessage[];
  model?: string; // Model is optional
  temperature?: number; // Example optional parameter
  max_tokens?: number; // Example optional parameter
  stream?: boolean; // Flag for streaming
  // Add other potential parameters here
}


/**
 * Calls the external AI service with the provided messages and handles a streaming response.
 * @param messages - An array of messages in the format expected by the AI service.
 * @param onChunk - Callback function invoked for each received text chunk.
 * @param onError - Callback function invoked if an error occurs during the stream.
 * @param onEnd - Callback function invoked when the stream finishes successfully or due to an error.
 */
export async function callExternalAIServiceStream(
  messages: AIMessage[],
  onChunk: (chunk: string) => void,
  onError: (error: Error) => void,
  onEnd: () => void
): Promise<void> {
  if (!API_URL || !API_KEY) {
    onError(new Error('AI Service URL or API Key is not configured in environment variables.'));
    onEnd(); // Ensure onEnd is called
    return;
  }

  console.log(`[aiService] Calling AI service (stream) at: ${API_URL}`);
  console.log(`[aiService] Using model: ${MODEL_NAME || 'Default'}`);

  const requestBody: AIRequestBody = {
    messages: messages,
    model: MODEL_NAME,
    stream: true, // Enable streaming
  };

  let streamClosed = false; // Flag to prevent multiple onEnd calls

  const handleEnd = () => {
    if (!streamClosed) {
      streamClosed = true;
      onEnd();
    }
  };

  const handleError = (error: Error) => {
    if (!streamClosed) { // Only call onError if stream hasn't already ended normally
      console.error('[aiService] Stream Error:', error.message);
      onError(error);
    }
    handleEnd(); // Always ensure onEnd is called on error
  };


  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000; // 1 second delay

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[aiService] Attempt ${attempt}/${MAX_RETRIES} to call AI service (stream)...`);
      const response = await axios.post(
        `${API_URL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'text/event-stream', // Necessary for SSE
          },
          responseType: 'stream', // Crucial for handling the response as a stream
          timeout: 300000, // Increase timeout significantly (e.g., 300 seconds / 5 minutes)
        }
      );

      // Cast to NodeJS.ReadStream which has destroy/destroyed
      const stream = response.data as NodeJS.ReadStream;

      // --- New approach using async iteration ---
      let buffer = '';
      let streamProcessedSuccessfully = false; // Flag to signal successful processing

      try { // Inner try for stream iteration
        for await (const chunk of stream) {
          if (streamClosed) break; // Stop processing if WebSocket closed

          buffer += chunk.toString();
          // Process Server-Sent Events (SSE) data format
          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + 1);

            if (line.startsWith('data: ')) {
              const dataContent = line.substring(6); // Skip 'data: '
              if (dataContent === '[DONE]') {
                console.log('[aiService] Received [DONE] signal.');
                continue; // Process next line
              }
              try {
                const parsed = JSON.parse(dataContent);
                // Check if delta.content exists (can be an empty string)
                if (parsed.choices && parsed.choices[0]?.delta && parsed.choices[0].delta.content !== undefined) {
                  const textChunk = parsed.choices[0].delta.content;
                  // Log the exact chunk being sent to the handler, even if empty
                  console.log(`[aiService] Raw chunk from API: "${textChunk}" (Length: ${textChunk?.length ?? 0})`);
                  // Pass the chunk to the handler regardless of content (handler will manage buffering/sending)
                  onChunk(textChunk);
                } else if (parsed.error) {
                  console.error('[aiService] Error message in stream data:', parsed.error);
                  const streamError = new Error(parsed.error.message || 'Unknown error in stream data');
                  handleError(streamError);
                  stream.destroy(streamError); // Explicitly destroy stream on error
                  streamClosed = true; // Mark as closed to prevent further processing
                  break; // Exit inner while loop
                }
              } catch (parseError) {
                if (line.trim() !== '' && !line.startsWith('event:') && !line.startsWith('id:') && !line.startsWith(':')) {
                  console.warn('[aiService] Non-JSON data line in stream (ignoring):', line, parseError);
                }
              }
            }
          } // end while
          if (streamClosed) break; // Check again after processing lines
        } // end for await

        if (!streamClosed) {
          console.log('[aiService] Stream iteration finished normally.');
          handleEnd(); // Signal normal completion
          streamProcessedSuccessfully = true; // Mark as successful
        } else {
          console.log('[aiService] Stream iteration aborted due to closure/error.');
          // Do not mark as successful if aborted
        }

      } catch (streamIterationError) {
        // Catch errors during the async iteration itself
        console.error('[aiService] Error during stream async iteration:', streamIterationError);
        if (!streamClosed) { // Avoid double-handling if already handled via parsed.error
          handleError(streamIterationError instanceof Error ? streamIterationError : new Error(String(streamIterationError)));
        }
      } finally {
        // Ensure stream is destroyed if not already ended/closed
        if (!stream.destroyed) {
          stream.destroy();
        }
        // handleEnd is now called explicitly on the success path above
        // or via handleError in the catch block below.
        // If the loop finishes due to streamClosed, handleEnd will be called by webSocketHandler eventually.
      }
      // --- End of new approach ---

      // --- Check for success and break retry loop ---
      if (streamProcessedSuccessfully) {
        console.log(`[aiService] Attempt ${attempt} successful, breaking retry loop.`);
        break; // <<< EXIT THE RETRY LOOP ON SUCCESS
      }
      // If not successful, the loop continues to the next attempt or enters the catch block below.

    } catch (error) { // Catch block for the outer try (axios.post)
      // --- Add log IMMEDIATELY upon entering catch ---
      console.error(`[aiService] ENTERED CATCH BLOCK for attempt ${attempt}.`);
      // --- End of added log ---

      console.error(`[aiService] Attempt ${attempt} failed:`, error); // Keep general log

      // Add more detailed logging for the specific error
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AIErrorResponse | { detail?: string }>;
        if (axiosError.response) {
          // Log status and data from the error response
          // Log status and simplified data type from the error response
          console.error(`[aiService] Axios Error Response (Attempt ${attempt}): Status=${axiosError.response.status}, Data Type=${typeof axiosError.response.data}`);
        } else if (axiosError.request) {
          // Log if no response was received
          console.error(`[aiService] Axios Error Request (Attempt ${attempt}): No response received.`);
        } else {
          // Log setup errors
          console.error(`[aiService] Axios Error Setup (Attempt ${attempt}): ${axiosError.message || 'No message'}`);
        }
      } else if (error instanceof Error) {
        console.error(`[aiService] Generic Error (Attempt ${attempt}): ${error.message || 'No message'}`);
      } else {
        console.error(`[aiService] Unknown Error (Attempt ${attempt}):`, error);
      }


      let errorMessage = `Failed to initiate communication with the AI service (stream) on attempt ${attempt}.`;
      let isRetryable = false;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AIErrorResponse | { detail?: string }>; // Define axiosError here
        if (axiosError.response) {
          // Handle response error
          const status = axiosError.response.status;
          // Retry on 5xx server errors
          if (status >= 500 && status < 600) {
            isRetryable = true;
          }
          const errorData = axiosError.response.data;
          let detail = 'Unknown API error';
          // Check if errorData exists and has the 'error' property before accessing 'message'
          if (errorData && typeof errorData === 'object' && 'error' in errorData && errorData.error && typeof errorData.error === 'object' && 'message' in errorData.error) {
            detail = String(errorData.error.message); // Convert to string just in case
          }
          // Check if errorData exists and has the 'detail' property
          else if (errorData && typeof errorData === 'object' && 'detail' in errorData && typeof errorData.detail === 'string') {
            detail = errorData.detail;
          } else if (typeof errorData === 'string') {
            detail = errorData;
          }
          errorMessage = `AI Service Stream Error (${status}): ${detail}`;
        } else if (axiosError.request) {
          // Handle request error (no response received)
          isRetryable = true; // Network errors might be temporary
          errorMessage = 'No response received from AI service for stream request.';
        } else {
          // Handle setup error (error setting up the request)
          // These are likely not retryable
          errorMessage = `Error setting up AI stream request: ${axiosError.message}`;
        }
      } else if (error instanceof Error) { // Handle generic JavaScript errors
        // Decide if generic errors are retryable (e.g., based on message?)
        // Let's be conservative and assume they are not retryable for now.
        errorMessage = error.message;
      } else {
        // Handle cases where the caught object is not an Error instance
        errorMessage = 'An unknown error occurred during the AI service call.';
      }

      // Retry logic: Check if the error is retryable and if we haven't exceeded the max attempts
      if (isRetryable && attempt < MAX_RETRIES) {
        console.log(`[aiService] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue; // Go to the next iteration of the loop
      }

      // If not retryable or retries exhausted, handle the final error and exit the loop
      if (!isRetryable || attempt >= MAX_RETRIES) {
        handleError(new Error(errorMessage));
        break; // Ensure loop breaks on final error
      }
      // ... (retry delay logic remains here) ...
    } // End of outer catch block
  } // End of for loop
} // End of callExternalAIServiceStream function


/**
 * Calls the external AI service with the provided messages (Non-streaming).
 * @deprecated Prefer callExternalAIServiceStream for chat interactions.
 * @param messages - An array of messages in the format expected by the AI service.
 * @returns The content of the AI's response message.
 * @throws An error if the API call fails or returns an unexpected format.
 */
export async function callExternalAIService(messages: AIMessage[]): Promise<string> {
  console.warn("[aiService] Non-streaming callExternalAIService is deprecated for chat.");
  if (!API_URL || !API_KEY) {
    throw new Error('AI Service URL or API Key is not configured in environment variables.');
  }

  console.log(`[aiService] Calling AI service (non-stream) at: ${API_URL}`);
  console.log(`[aiService] Using model: ${MODEL_NAME || 'Default'}`);

  try {
    const requestBody: AIRequestBody = {
      messages: messages,
      // stream: false // Explicitly false or omitted for non-streaming
    };
    if (MODEL_NAME) {
      requestBody.model = MODEL_NAME;
    }

    const response = await axios.post<AISuccessResponse>(
      `${API_URL}/chat/completions`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 30000, // Standard timeout for non-streaming
      }
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0 &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content
    ) {
      return response.data.choices[0].message.content.trim();
    } else {
      console.error('[aiService] Unexpected non-stream response structure:', response.data);
      throw new Error('Received an unexpected non-stream response structure from the AI service.');
    }
  } catch (error) {
    console.error('[aiService] Error calling non-stream AI service:', error);
    let errorMessage = 'Failed to communicate with the AI service (non-stream).';
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<AIErrorResponse | { detail?: string }>;
      if (axiosError.response) {
        const errorData = axiosError.response.data;
        let detail = 'Unknown API error';
        // Check if errorData exists and has the 'error' property before accessing 'message'
        if (errorData && typeof errorData === 'object' && 'error' in errorData && errorData.error && typeof errorData.error === 'object' && 'message' in errorData.error) {
          detail = String(errorData.error.message);
        }
        // Check if errorData exists and has the 'detail' property
        else if (errorData && typeof errorData === 'object' && 'detail' in errorData && typeof errorData.detail === 'string') {
          detail = errorData.detail;
        } else if (typeof errorData === 'string') {
          detail = errorData;
        }
        errorMessage = `AI Service Non-Stream Error (${axiosError.response.status}): ${detail}`;
      } else if (axiosError.request) {
        errorMessage = 'No response received from AI service for non-stream request.';
      } else {
        errorMessage = `Error setting up AI non-stream request: ${axiosError.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
}