import { WebSocket } from 'ws';
import { callAIServiceAndGetResponse, buildSystemPrompt } from './aiService.js'; // Use .js extension and import new functions
import type { AIMessage } from './aiService.js'; // Use .js extension
// Removed incorrect import: import type { ServerPayload } from '../../src/types/index.js';

// --- Define ServerPayload locally (duplicate from frontend types) ---
interface ServerPayload {
  text: string;
  emotion?: string;
}

// Define the structure of messages received from the client via WebSocket
interface ClientChatMessage {
  type: 'chat';
  payload: {
    userInput: string;
    personalityCore: string;
    history: AIMessage[]; // Reuse AIMessage for history format consistency
    userName?: string;
  };
}

// Define the structure of messages sent to the client via WebSocket
interface ServerMessage {
  type: 'chunk' | 'error' | 'fullResponse' | 'processing' | 'idle';
  // Payload can be the structured object or a simple string
  payload: ServerPayload | string;
}

// --- Buffering/Throttling Configuration (No longer needed) ---
// const MIN_CHUNK_SIZE = 1; // Removed

export function handleWebSocketConnection(ws: WebSocket) {
  // Remove buffer variables
  // let messageBuffer: string = '';
  // let bufferTimeout: NodeJS.Timeout | null = null;
  let isAIProcessing: boolean = false; // Track if AI is currently processing
  let isConnectionClosed: boolean = false; // Flag to track connection state

  const sendToClient = (message: ServerMessage) => { // Type signature updated automatically by TS
    // Check connection flag first
    if (isConnectionClosed) {
      // console.log('[WebSocketHandler] Suppressing send, connection is closed.');
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      const messageString = JSON.stringify(message);
      // Log the message being sent
      console.log(`[WebSocketHandler] Sending to client: ${messageString}`);
      ws.send(messageString);
    } else {
      // Log only if we didn't expect it to be closed
      console.warn('[WebSocketHandler] Attempted to send message to socket not in OPEN state.');
    }
  };

  // Remove flushBuffer and handleChunk

  // --- New Callback for Completed Response ---
  const handleComplete = (payload: ServerPayload) => {
    if (isConnectionClosed) return;
    console.log('[WebSocketHandler] Received complete payload from AI Service:', payload);
    // Send the structured payload using 'fullResponse' type
    sendToClient({ type: 'fullResponse', payload: payload });
    // Note: handleEnd will be called separately by aiService to send 'idle'
  };

  const handleError = (error: Error) => {
    if (isConnectionClosed) return;
    console.error('[WebSocketHandler] AI Service Error:', error.message);
    // No buffer to flush
    sendToClient({ type: 'error', payload: `AI Error: ${error.message}` });
    // isAIProcessing = false; // Let handleEnd manage this state
    // sendToClient({ type: 'idle', payload: '' }); // Let handleEnd manage this
  };

  const handleEnd = () => { // Called by aiService on success or error completion
    if (isConnectionClosed) return;
    console.log('[WebSocketHandler] AI processing finished (handleEnd called).');
    // No buffer to flush
    // Response is sent via handleComplete or error via handleError
    isAIProcessing = false; // Reset processing state *here*
    sendToClient({ type: 'idle', payload: '' }); // Inform client processing stopped *here*
  };

  ws.on('message', async (message) => {
    try {
      const parsedMessage: ClientChatMessage = JSON.parse(message.toString());

      if (parsedMessage.type === 'chat') {
        if (isAIProcessing) {
          console.warn('[WebSocketHandler] Received chat message while AI is already processing. Ignoring.');
          sendToClient({ type: 'error', payload: 'AI is already processing a request.' });
          return;
        }

        isAIProcessing = true;
        sendToClient({ type: 'processing', payload: '' }); // Inform client processing started

        const { userInput, personalityCore, history, userName } = parsedMessage.payload;

        // --- Construct Prompt for AI Service ---
        // --- Construct System Prompt using helper ---
        const systemPrompt = buildSystemPrompt(personalityCore, userName);
        console.log('[WebSocketHandler] Constructed System Prompt:', systemPrompt); // Log the prompt

        // History from client already includes user/assistant roles correctly
        const historyForAI: AIMessage[] = [
          // System prompt is now passed separately to callAIServiceAndGetResponse
          ...history,
          { role: 'user', content: userInput } // Add latest user input
        ];

        console.log('[WebSocketHandler] Sending request to AI service...');

        // --- Call AI Service with Buffering and Parsing ---
        await callAIServiceAndGetResponse(
          systemPrompt, // Pass the constructed system prompt
          historyForAI, // Pass the history
          handleComplete, // Pass the new completion handler
          handleError,
          handleEnd
        );
      } else {
        console.warn('[WebSocketHandler] Received unknown message type:', parsedMessage.type);
        sendToClient({ type: 'error', payload: `Unknown message type: ${parsedMessage.type}` });
      }
    } catch (error) {
      console.error('[WebSocketHandler] Error processing client message:', error);
      sendToClient({ type: 'error', payload: 'Invalid message format received.' });
      if (isAIProcessing) {
        isAIProcessing = false; // Reset state on error
        sendToClient({ type: 'idle', payload: '' });
      }
    }
  });

  ws.on('close', (code, reason) => { // Add code and reason parameters
    // Log *before* setting the flag
    console.log(`[WebSocketHandler DEBUG] ws.on('close') triggered! Code: ${code}, Reason: ${reason?.toString()}`);
    console.log('[WebSocketHandler] Connection closed. Setting flag.');
    isConnectionClosed = true; // Set the flag
    // Remove buffer timeout clearing
    // if (bufferTimeout) {
    //   clearTimeout(bufferTimeout);
    //   bufferTimeout = null;
    // }
    // TODO: Ideally, signal the AI stream to abort if possible.
    // This is harder without passing a cancellation token or similar mechanism.
    // For now, setting the flag prevents sending to the closed socket.
  });

  ws.on('error', (error) => {
    // Log *before* setting the flag
    console.error(`[WebSocketHandler DEBUG] ws.on('error') triggered! Error: ${error.message}`);
    console.error('[WebSocketHandler] WebSocket error:', error);
    isConnectionClosed = true; // Also set flag on error
    // Remove buffer timeout clearing
    // if (bufferTimeout) {
    //   clearTimeout(bufferTimeout);
    //   bufferTimeout = null;
    // }
    isAIProcessing = false; // Reset state on error
  });
}