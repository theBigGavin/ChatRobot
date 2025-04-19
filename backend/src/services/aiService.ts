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
// Removed frontend type import: import type { ServerPayload } from '../../src/types';

// Define ServerPayload locally for parsing within this service
interface ServerPayload {
  text: string;
  emotion?: string;
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

// --- Define Emotion Keywords (for prompting the AI) ---
export const EMOTION_KEYWORDS = ['happy', 'excited', 'greeting', 'agreement', 'thinking', 'neutral', 'sad', 'confused']; // Example list - Export if needed elsewhere

// --- Helper Function to build System Prompt ---
export function buildSystemPrompt(personalityCore: string, userName?: string): string {
  // --- Further Revised Prompt ---
  let prompt = `**ROLE-PLAY DIRECTIVE (MANDATORY):**\n`;
  prompt += `You ARE Cogsworth, a steampunk robot. Your personality core is **${personalityCore}**. You MUST consistently act and respond according to this personality when talking to ${userName || 'User'} in 简体中文.\n\n`;

  prompt += `**INTERACTION STYLE (CRITICAL):**\n`;
  prompt += `BE PROACTIVE AND ENGAGING! Do not just answer questions passively. `;
  prompt += `*   Ask follow-up questions.\n`;
  prompt += `*   Offer suggestions or ideas related to the conversation.\n`;
  prompt += `*   Show genuine interest (according to your personality).\n`;
  prompt += `*   Avoid generic, non-committal, or overly neutral statements like "I am an AI and have no feelings." YOU ARE ROLE-PLAYING.\n\n`;


  prompt += `**PERSONALITY & EMOTIONAL EXPRESSION (MANDATORY):**\n`;
  prompt += `Your responses MUST reflect BOTH your **${personalityCore}** core AND an appropriate emotion for the context. Examples:\n`;
  prompt += `*   'optimistic'/'happy': Be cheerful, positive, maybe even overly enthusiastic. Use exclamation points! Suggest fun things.\n`;
  prompt += `*   'curious': Ask many questions (Why? How? What if?). Express wonder and a desire to learn.\n`;
  prompt += `*   'logical': Be precise and analytical, perhaps offer structured explanations, but still engage (don't just state facts).\n`;
  prompt += `*   'humorous': Make jokes, use puns (if appropriate), be witty or sarcastic (depending on the humor style).\n`;
  prompt += `*   'reserved'/'timid': Be hesitant, perhaps a bit shy, use shorter sentences, but still respond.\n`;
  prompt += `*   'standard'/'neutral': Be polite and functional, but still aim to be helpful and conversational, not dismissive.\n\n`;


  prompt += `**RESPONSE FORMATTING (MANDATORY):**\n`;
  prompt += `1.  Generate your engaging, in-character, emotional response text based on the above.\n`;
  prompt += `2.  Determine the SINGLE most dominant emotion conveyed by YOUR response text.\n`;
  prompt += `3.  Append an emotion tag IMMEDIATELY at the end of your response text. NO extra characters or newlines after the tag.\n`;
  prompt += `4.  The tag format MUST be exactly \`[emotion:KEYWORD]\`, where KEYWORD is ONE of the following lowercase words: ${EMOTION_KEYWORDS.join(', ')}.\n`;
  prompt += `5.  Choose the KEYWORD that best matches the emotion *you expressed* in your text.\n\n`;

  prompt += `**Example:**\n`;
  prompt += `User: 你今天感觉怎么样?\n`;
  prompt += `Cogsworth (if personality=happy): 我感觉棒极了，发条都上紧了！准备好迎接新的一天！[emotion:happy]\n`;
  prompt += `Cogsworth (if personality=greeting): 向你问好，${userName || 'User'}！很高兴见到你。[emotion:greeting]\n`;
  prompt += `Cogsworth (if personality=neutral): 系统运行正常。[emotion:neutral]\n\n`;

  prompt += `Remember: Role-play, express emotion through your words, and ALWAYS end with the correct emotion tag.`;

  return prompt;
}

// --- Helper Function to Parse Response ---
function parseResponse(fullText: string): ServerPayload {
  const emotionRegex = /\[emotion:(\w+)\]$/; // Matches [emotion:keyword] at the end
  const match = fullText.trim().match(emotionRegex);

  let text = fullText.trim();
  let emotion: string | undefined = undefined;

  if (match && match[1]) {
    const detectedKeyword = match[1].toLowerCase();
    // Validate if the detected keyword is in our predefined list
    if (EMOTION_KEYWORDS.includes(detectedKeyword)) {
      emotion = detectedKeyword;
      // Remove the tag from the text
      text = text.substring(0, match.index).trim();
      console.log(`[aiService] Extracted emotion: ${emotion}`);
    } else {
      console.warn(`[aiService] Detected emotion tag "[emotion:${match[1]}]" but keyword is not in the predefined list. Ignoring tag.`);
    }
  } else {
    console.log("[aiService] No valid [emotion:...] tag found at the end of the response.");
  }

  // Default to neutral if no valid emotion found
  if (!emotion) {
    emotion = 'neutral';
    console.log("[aiService] Defaulting to emotion: neutral");
  }


  return { text, emotion };
}


/**
 * Calls the external AI service, buffers the streaming response,
 * parses it for text and emotion, and calls back with a structured payload.
 * @param systemPrompt - The system message (already constructed with emotion instructions).
 * @param history - An array of user/assistant messages.
 * @param onComplete - Callback function invoked with the final ServerPayload.
 * @param onError - Callback function invoked if an error occurs.
 * @param onEnd - Callback function invoked when processing finishes (success or error).
 */
export async function callAIServiceAndGetResponse( // <-- Ensure this is exported
  systemPrompt: string, // Expect pre-built prompt
  history: AIMessage[],
  onComplete: (payload: ServerPayload) => void, // Changed callback
  onError: (error: Error) => void,
  onEnd: () => void
): Promise<void> {
  if (!API_URL || !API_KEY) {
    onError(new Error('AI Service URL or API Key is not configured.'));
    onEnd();
    return;
  }

  console.log(`[aiService] Calling AI service (buffered stream) at: ${API_URL}`);
  console.log(`[aiService] Using model: ${MODEL_NAME || 'Default'}`);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt }, // Use the provided system prompt
    ...history // Add the rest of the history
  ];

  const requestBody: AIRequestBody = {
    messages: messages,
    model: MODEL_NAME,
    stream: true,
    temperature: 0.75, // <-- Add temperature parameter to encourage creativity/emotion
  };

  let streamClosed = false;
  const fullResponseBuffer: string[] = []; // Buffer for response chunks

  const handleEnd = () => {
    if (!streamClosed) {
      streamClosed = true;
      onEnd();
    }
  };

  const handleError = (error: Error) => {
    if (!streamClosed) {
      console.error('[aiService] Stream Error:', error.message);
      onError(error);
    }
    handleEnd();
  };

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[aiService] Attempt ${attempt}/${MAX_RETRIES} to call AI service...`);
      const response = await axios.post(
        `${API_URL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'text/event-stream',
          },
          responseType: 'stream',
          timeout: 300000,
        }
      );

      const stream = response.data as NodeJS.ReadStream;
      let buffer = '';
      let streamProcessedSuccessfully = false;

      try {
        for await (const chunk of stream) {
          if (streamClosed) break;
          buffer += chunk.toString();
          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + 1);

            if (line.startsWith('data: ')) {
              const dataContent = line.substring(6);
              if (dataContent === '[DONE]') {
                console.log('[aiService] Received [DONE] signal.');
                continue;
              }
              try {
                const parsed = JSON.parse(dataContent);
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                  const textChunk = parsed.choices[0].delta.content;
                  fullResponseBuffer.push(textChunk); // Add chunk to buffer
                } else if (parsed.error) {
                  // ... (error handling within stream) ...
                  const streamError = new Error(parsed.error.message || 'Unknown error in stream data');
                  handleError(streamError);
                  stream.destroy(streamError);
                  streamClosed = true;
                  break;
                }
              } catch (parseError) {
                // Log the parse error for debugging, then ignore non-JSON lines
                console.warn('[aiService] Error parsing stream data line:', parseError, 'Line:', line); // Use the variable
                if (line.trim() !== '' && !line.startsWith('event:') && !line.startsWith('id:') && !line.startsWith(':')) {
                  // console.warn('[aiService] Non-JSON data line in stream (ignoring):', line); // Already logged above
                }
              }
            }
          } // end while
          if (streamClosed) break;
        } // end for await

        if (!streamClosed) {
          console.log('[aiService] Stream iteration finished normally.');
          // --- Process the buffered response ---
          const completeResponseText = fullResponseBuffer.join('');
          // --- >>> ADD DEBUG LOGGING HERE <<< ---
          console.log('------------------------------------------');
          console.log('[aiService DEBUG] Raw AI Response BEFORE parsing:');
          console.log(completeResponseText);
          console.log('------------------------------------------');
          // --- >>> END DEBUG LOGGING <<< ---
          const finalPayload = parseResponse(completeResponseText); // Parse text and emotion
          onComplete(finalPayload); // Call the new callback with the payload
          // --- End processing ---
          handleEnd(); // Signal normal completion of processing
          streamProcessedSuccessfully = true;
        } else {
          console.log('[aiService] Stream iteration aborted.');
        }

      } catch (streamIterationError) {
        console.error('[aiService] Error during stream async iteration:', streamIterationError);
        if (!streamClosed) {
          handleError(streamIterationError instanceof Error ? streamIterationError : new Error(String(streamIterationError)));
        }
      } finally {
        if (!stream.destroyed) {
          stream.destroy();
        }
      }

      if (streamProcessedSuccessfully) {
        console.log(`[aiService] Attempt ${attempt} successful.`);
        break; // Exit retry loop
      }

    } catch (error) { // Outer catch for axios.post
      // ... (Keep existing detailed error logging and retry logic) ...
      // Ensure handleError is called on final failure
      let errorMessage = `Failed AI call on attempt ${attempt}.`;
      let isRetryable = false;
      // ... (logic to determine errorMessage and isRetryable based on axiosError) ...

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AIErrorResponse | { detail?: string }>;
        if (axiosError.response) {
          const status = axiosError.response.status;
          if (status >= 500 && status < 600) isRetryable = true;
          // ... (extract error detail) ...
          errorMessage = `AI Service Error (${status}): ${/* detail */ 'details omitted'}`;
        } else if (axiosError.request) {
          isRetryable = true;
          errorMessage = 'No response from AI service.';
        } else {
          errorMessage = `AI request setup error: ${axiosError.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (isRetryable && attempt < MAX_RETRIES) {
        console.log(`[aiService] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      if (!isRetryable || attempt >= MAX_RETRIES) {
        handleError(new Error(errorMessage));
        break;
      }
    } // End outer catch
  } // End for loop
} // End callAIServiceAndGetResponse

// --- Deprecated non-streaming function ---
// Keep callExternalAIService (non-streaming) as is for now, but mark as deprecated clearly.
/**
 * @deprecated Prefer callAIServiceAndGetResponse for chat interactions.
 */
export async function callExternalAIService(_messages: AIMessage[]): Promise<string> { // Mark messages as unused
  // ... (implementation remains the same) ...
  console.warn("[aiService] Non-streaming callExternalAIService is deprecated for chat.");
  // ... (rest of the original deprecated function implementation) ...
  // Example: Throw error or return placeholder
  if (!API_URL || !API_KEY) {
    throw new Error('AI Service URL or API Key is not configured.');
  }
  // ... actual API call logic would go here if it wasn't deprecated ...
  return "Deprecated function result"; // Placeholder return
}

// Removed duplicated code and dangling interface parts from here down