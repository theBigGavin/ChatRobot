import { WebSocket } from 'ws';
import { callExternalAIServiceStream } from './aiService.js'; // Use .js extension
import type { AIMessage } from './aiService.js'; // Use .js extension

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
  payload: string; // For chunk, error, fullResponse
}

// --- Buffering/Throttling Configuration ---
// Adjusted for more immediate sending
// const BUFFER_INTERVAL_MS = 50; // Reduced interval (though less relevant now) - Removed as unused
const MIN_CHUNK_SIZE = 1; // Send as soon as we have at least 1 character

export function handleWebSocketConnection(ws: WebSocket) {
  let messageBuffer: string = '';
  let bufferTimeout: NodeJS.Timeout | null = null;
  let isAIProcessing: boolean = false; // Track if AI is currently processing
  let isConnectionClosed: boolean = false; // Flag to track connection state

  const sendToClient = (message: ServerMessage) => {
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

  const flushBuffer = () => {
    console.log(`[WebSocketHandler DEBUG] Entering flushBuffer. Buffer: "${messageBuffer}", Length: ${messageBuffer.length}`); // DEBUG log
    // Send buffer content if it's not empty (without trimming)
    if (messageBuffer.length > 0) {
      console.log(`[WebSocketHandler DEBUG] Buffer not empty in flushBuffer, calling sendToClient.`); // DEBUG log
      sendToClient({ type: 'chunk', payload: messageBuffer }); // Send the original buffer
      messageBuffer = ''; // Clear buffer after sending
    } else {
      console.log(`[WebSocketHandler DEBUG] Buffer empty in flushBuffer, not sending.`); // DEBUG log
    }
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
  };

  const handleChunk = (chunk: string) => {
    console.log(`[WebSocketHandler DEBUG] Entering handleChunk. Received chunk: "${chunk}", isConnectionClosed: ${isConnectionClosed}`); // DEBUG log
    if (isConnectionClosed) {
      console.log(`[WebSocketHandler DEBUG] Exiting handleChunk early: isConnectionClosed is true.`); // DEBUG log
      return;
    }
    messageBuffer += chunk;
    console.log(`[WebSocketHandler DEBUG] Buffer after append: "${messageBuffer}"`); // DEBUG log

    // Send immediately if buffer meets the minimum size (now 1)
    if (messageBuffer.length >= MIN_CHUNK_SIZE) {
      console.log(`[WebSocketHandler DEBUG] Buffer meets MIN_CHUNK_SIZE (${MIN_CHUNK_SIZE}), calling flushBuffer.`); // DEBUG log
      flushBuffer();
    } else {
      console.log(`[WebSocketHandler DEBUG] Buffer length (${messageBuffer.length}) < MIN_CHUNK_SIZE (${MIN_CHUNK_SIZE}), not flushing yet.`); // DEBUG log
    }
    // Removed the else if block that relied on BUFFER_INTERVAL_MS timeout.
    // We now primarily rely on MIN_CHUNK_SIZE = 1 for immediate flushing.
    // A small safety timeout could be added here if needed, but let's try without first.
  };

  const handleError = (error: Error) => {
    if (isConnectionClosed) return; // Stop processing if connection closed
    console.error('[WebSocketHandler] AI Service Error:', error.message);
    flushBuffer(); // Send any remaining buffered text before the error
    sendToClient({ type: 'error', payload: `AI Error: ${error.message}` });
    isAIProcessing = false; // Reset processing state
    sendToClient({ type: 'idle', payload: '' }); // Inform client processing stopped
  };

  const handleEnd = () => {
    if (isConnectionClosed) return; // Stop processing if connection closed
    console.log('[WebSocketHandler] AI Stream finished.');
    flushBuffer(); // Ensure the last part of the message is sent
    // Optionally send a full response if needed, though chunks might be sufficient
    // sendToClient({ type: 'fullResponse', payload: accumulatedResponse });
    isAIProcessing = false; // Reset processing state
    sendToClient({ type: 'idle', payload: '' }); // Inform client processing stopped
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
        // Modified to request Chinese responses
        const systemPrompt = `你是 Cogsworth，一个具有 ${personalityCore} 性格的蒸汽朋克机器人。你正在和 ${userName || '用户'} 对话。请始终使用简体中文回复，保持简洁并符合你的角色设定。`;


        const messages: AIMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history, // History from client
          // The latest userInput is now added here, not assumed to be in history
          { role: 'user', content: userInput }
        ];

        console.log('[WebSocketHandler] Sending messages to AI service (stream)...');

        // --- Call Streaming AI Service ---
        await callExternalAIServiceStream(
          messages,
          handleChunk,
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
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    // TODO: Ideally, signal the AI stream to abort if possible.
    // This is harder without passing a cancellation token or similar mechanism.
    // For now, setting the flag prevents sending to the closed socket.
  });

  ws.on('error', (error) => {
    // Log *before* setting the flag
    console.error(`[WebSocketHandler DEBUG] ws.on('error') triggered! Error: ${error.message}`);
    console.error('[WebSocketHandler] WebSocket error:', error);
    isConnectionClosed = true; // Also set flag on error
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    isAIProcessing = false; // Reset state on error
  });
}