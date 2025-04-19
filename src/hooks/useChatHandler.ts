import { useState, useRef, useCallback } from 'react';
import { useAppStore, selectRobotConfig } from '../store/useAppStore';
import type { ServerMessage, ClientChatMessage, ChatMessage, AIMessage, ServerPayload } from '../types'; // <-- Import ServerPayload
import type { AnimationName } from '../types/robot'; // <-- Correct import path for AnimationName
import useWebSocketManager from './useWebSocketManager';
import useTypingAnimator from './useTypingAnimator';
import useSpeechSynthesizer from './useSpeechSynthesizer';
// import { findFirstEmoteTrigger } from '../utils/chatUtils'; // <-- No longer needed here for animation trigger

// Define the return type of the hook - what the UI component needs
export interface ChatHandler {
  isConnected: boolean;
  isBotProcessing: boolean;
  submitUserMessage: (userText: string) => void;
  // Potentially expose other states or functions if needed by UI
}

/**
 * Custom Hook to orchestrate chat logic, coordinating WebSocket, typing animation, and speech synthesis.
 */
const useChatHandler = (): ChatHandler => {
  const isStreamCompleteRef = useRef(false); // <-- Add Ref to track stream completion
  // --- State Management ---
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const currentBotMessageId = useRef<string | null>(null);
  const accumulatedBotResponse = useRef<string>("");

  // --- Zustand Store Access ---
  const addChatMessage = useAppStore((store) => store.addChatMessage);
  const updateMessageText = useAppStore((store) => store.updateMessageText);
  // const triggerEmote = useAppStore((store) => store.triggerEmote); // <-- Comment out or remove old emote trigger if replaced by animation
  const playAnimation = useAppStore((store) => store.playAnimation); // <-- Import playAnimation action
  const robotConfig = useAppStore(selectRobotConfig);
  // Note: We might not need direct access to all store actions/state here
  // if they are only used within the other specialized hooks.

  // --- Instantiate Child Hooks ---
  const { speak, cancelSpeech } = useSpeechSynthesizer();

  // --- Define Emoji to Animation Mapping ---
  // --- Define Emotion Keyword to Animation Mapping ---
  const emotionKeywordToAnimationMap: Record<string, AnimationName> = {
    'happy': 'jump',
    'excited': 'jump',
    'greeting': 'wave',
    'agreement': 'wave', // Or 'nod' if available
    'thinking': 'idle',
    'neutral': 'idle',
    'sad': 'idle', // Needs specific animation
    'confused': 'idle', // Needs specific animation
    // Add more mappings based on defined keywords
  };

  // Ref to store the emotion received for the current message stream
  const currentEmotionRef = useRef<string | null>(null);


  const handleAnimationComplete = useCallback(
    (messageId: string, finalText: string) => {
      // --- >>> ADD LOGGING <<< ---
      console.log(`[useChatHandler DEBUG] handleAnimationComplete called for messageId: ${messageId}`);
      console.log(`[useChatHandler DEBUG] Final text: "${finalText}"`);
      console.log(`[useChatHandler DEBUG] Emotion stored in ref: ${currentEmotionRef.current}`);
      // --- >>> END LOGGING <<< ---

      // --- Trigger Animation based on stored Emotion Keyword ---
      const emotionKeyword = currentEmotionRef.current;
      let animationToPlay: AnimationName = 'idle'; // Default to idle

      if (emotionKeyword && emotionKeywordToAnimationMap[emotionKeyword]) {
        animationToPlay = emotionKeywordToAnimationMap[emotionKeyword];
        console.log(`[useChatHandler DEBUG] Emotion keyword '${emotionKeyword}', found mapping: ${animationToPlay}`);
      } else {
        console.log(`[useChatHandler DEBUG] No specific emotion keyword found ('${emotionKeyword}') or mapped, defaulting to idle animation.`);
      }
      // --- >>> ADD LOGGING <<< ---
      console.log(`[useChatHandler DEBUG] Calling playAnimation with: ${animationToPlay}`);
      // --- >>> END LOGGING <<< ---
      playAnimation(animationToPlay); // Trigger the animation via Zustand store

      // --- (Optional) Old Emote Trigger Logic ---
      // import { findFirstEmoteTrigger } from '../utils/chatUtils';
      // const detectedEmoteAction = findFirstEmoteTrigger(finalText);
      // if (detectedEmoteAction) {
      //    console.log("[useChatHandler] Detected emote action (for other purposes):", detectedEmoteAction);
      //    // triggerEmote(detectedEmoteAction); // If you still need the old EmoteAction system
      // }
      // const detectedEmote = findFirstEmoteTrigger(finalText);
      // if (detectedEmote) {
      //   console.log("[useChatHandler] Triggering (old) emote:", detectedEmote);
      //   triggerEmote(detectedEmote);
      // }

      // --- Speak the final text ---
      speak(finalText, () => {
        console.log("[useChatHandler] Speech finished for:", messageId);
      });

      // Reset message-specific state
      currentBotMessageId.current = null;
      accumulatedBotResponse.current = "";
      // Set processing to false only AFTER animation and speech are done
      setIsBotProcessing(false); // <-- Move setIsBotProcessing here
    },
    [speak, playAnimation, setIsBotProcessing, emotionKeywordToAnimationMap] // Updated dependencies
  );

  const { startAnimation, stopAnimation, addToQueue } = useTypingAnimator({
    // Pass refs directly
    messageIdRef: currentBotMessageId,
    accumulatedResponseRef: accumulatedBotResponse,
    isStreamCompleteRef: isStreamCompleteRef, // <-- Pass the new ref
    updateMessageText: updateMessageText,
    onAnimationComplete: handleAnimationComplete,
  });

  const handleWebSocketMessage = useCallback(
    (message: ServerMessage) => {
      // console.log("[useChatHandler] Received raw message:", message); // DEBUG
      try {
        // --- Attempt to parse the message payload as JSON ---
        // Backend needs to send JSON strings now, e.g., '{ "type": "chunk", "payload": { "text": "Hi", "emotion": "greeting" } }'
        // Or handle potential non-JSON messages if backend transition is partial
        const parsedMessage: ServerMessage = typeof message === 'string' ? JSON.parse(message) : message; // Basic check if already object
        // We will check payload type inside each case block now

        // console.log("[useChatHandler] Parsed message:", parsedMessage); // DEBUG

        switch (parsedMessage.type) {
          case "processing": {
            setIsBotProcessing(true);
            isStreamCompleteRef.current = false;
            accumulatedBotResponse.current = "";
            currentEmotionRef.current = null; // Reset emotion for new message
            stopAnimation();

            const botMessageId = `msg-${Date.now()}-${Math.random()}`;
            const placeholderMessage: ChatMessage = {
              id: botMessageId, sender: "bot", text: "", timestamp: Date.now(),
            };
            addChatMessage(placeholderMessage);
            currentBotMessageId.current = botMessageId;
            startAnimation();
            break;
          }
          case "chunk": { // Add block scope
            // Type check for payload
            if (typeof parsedMessage.payload === 'object' && parsedMessage.payload !== null) {
              const payload = parsedMessage.payload as ServerPayload; // Type assertion after check
              if (currentBotMessageId.current && payload.text) {
                accumulatedBotResponse.current += payload.text;
                const charsToAdd = payload.text.split("");
                addToQueue(charsToAdd);
                // Store the emotion from the first chunk (or latest chunk if it changes)
                if (payload.emotion && !currentEmotionRef.current) {
                  currentEmotionRef.current = payload.emotion;
                  console.log(`[useChatHandler] Stored emotion from chunk: ${payload.emotion}`);
                }
              } else {
                console.warn("[useChatHandler] Received chunk but no active bot message ID or missing text in payload");
              }
            } else {
              console.warn("[useChatHandler] Received chunk with unexpected payload type:", parsedMessage.payload);
            }
            break;
          }
          case "fullResponse": { // Add block scope
            // --- >>> ADD LOGGING <<< ---
            console.log("[useChatHandler DEBUG] Handling 'fullResponse' message type.");
            // --- >>> END LOGGING <<< ---
            if (typeof parsedMessage.payload === 'object' && parsedMessage.payload !== null) {
              const payload = parsedMessage.payload as ServerPayload; // Type assertion after check
              if (currentBotMessageId.current && payload.text) {
                accumulatedBotResponse.current = payload.text; // Set final text
                const charsToAdd = payload.text.split("");
                addToQueue(charsToAdd); // Add all chars to queue
                isStreamCompleteRef.current = true; // Signal stream end immediately
                if (payload.emotion) {
                  currentEmotionRef.current = payload.emotion;
                  // --- >>> ADD LOGGING <<< ---
                  console.log(`[useChatHandler DEBUG] Stored emotion from fullResponse: ${payload.emotion}`);
                  // --- >>> END LOGGING <<< ---
                } else {
                  // --- >>> ADD LOGGING <<< ---
                  console.log("[useChatHandler DEBUG] fullResponse payload did not contain an emotion field.");
                  // --- >>> END LOGGING <<< ---
                  currentEmotionRef.current = null; // Ensure it's null if not provided
                }
                // NOTE: Animation is triggered in handleAnimationComplete AFTER typing animation finishes
              } else {
                console.warn("[useChatHandler] Received fullResponse but no active bot message ID or missing text in payload");
              }
            } else {
              console.warn("[useChatHandler] Received fullResponse with unexpected payload type:", parsedMessage.payload);
            }
            break;
          }
          case "idle":
            // console.log("[useChatHandler] Received idle signal."); // DEBUG
            isStreamCompleteRef.current = true;
            break;
          case "error": { // Add block scope for lexical declaration
            const payload = parsedMessage.payload; // Keep payload as string | ServerPayload
            console.error("[useChatHandler] Server Error:", payload); // Log the whole payload
            stopAnimation();
            setIsBotProcessing(false);
            // Handle both string and object payloads for error message
            const errorText = typeof payload === 'string'
              ? payload
              : (payload && typeof payload === 'object' && 'text' in payload)
                ? (payload as ServerPayload).text // Try to get text if it's an object
                : JSON.stringify(payload); // Fallback to stringify
            if (currentBotMessageId.current) {
              updateMessageText(currentBotMessageId.current, `Error: ${errorText}`);
            } else {
              addChatMessage({ id: `err-${Date.now()}`, sender: "system", text: `Server Error: ${errorText}`, timestamp: Date.now() });
            }
            currentBotMessageId.current = null;
            accumulatedBotResponse.current = "";
            currentEmotionRef.current = null;
            break;
          } // <-- Add missing closing brace for case "error"
          default:
            console.warn("[useChatHandler] Received unknown message type:", parsedMessage.type);
        }
      } catch (error) {
        console.error("[useChatHandler] Failed to parse WebSocket message or process:", error, "Raw message:", message);
        // Handle potential parsing errors gracefully, maybe show a generic error message
        stopAnimation();
        setIsBotProcessing(false);
        if (currentBotMessageId.current) {
          updateMessageText(currentBotMessageId.current, "Error: Received invalid message format from server.");
        } else {
          addChatMessage({ id: `err-${Date.now()}`, sender: "system", text: "Error: Received invalid message format from server.", timestamp: Date.now() });
        }
        currentBotMessageId.current = null;
        accumulatedBotResponse.current = "";
        currentEmotionRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addChatMessage, updateMessageText, setIsBotProcessing /* Keep minimal deps */]
  );

  const { isConnected, sendMessage } = useWebSocketManager({
    onMessage: handleWebSocketMessage,
  });

  // --- User Interaction Logic ---
  const submitUserMessage = useCallback((userText: string) => {
    if (!isConnected || !userText.trim()) {
      console.warn("[useChatHandler] Cannot send message. Not connected or empty input.");
      // Optionally provide feedback to the user via state update
      return;
    }

    // Cancel any ongoing bot processes
    cancelSpeech();
    stopAnimation();
    // triggerEmote(null); // Comment out if replacing with animation reset
    playAnimation('idle'); // Reset to idle animation when user sends a message

    // Add user message to history (assuming ChatConsole handles this via store now)
    // If not, addChatMessage for user message would go here.

    // Prepare history for backend
    const currentChatHistory = useAppStore.getState().chatHistory; // Get latest history
    const currentUserName = useAppStore.getState().robotState.memory.userName || "User";
    const apiHistory = currentChatHistory
      .filter((msg) => msg.id !== currentBotMessageId.current)
      .slice(-10)
      .map((msg): AIMessage => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));

    // Reset accumulator for the *next* bot response
    accumulatedBotResponse.current = "";

    const messageToSend: ClientChatMessage = {
      type: "chat",
      payload: {
        userInput: userText,
        personalityCore: robotConfig.personalityCore,
        history: apiHistory,
        userName: currentUserName,
      },
    };

    // console.log("[useChatHandler] Sending message:", messageToSend); // DEBUG
    sendMessage(messageToSend);

  }, [isConnected, sendMessage, cancelSpeech, stopAnimation, playAnimation, robotConfig.personalityCore]); // Update dependencies

  // --- Return values needed by the UI ---
  return {
    isConnected,
    isBotProcessing,
    submitUserMessage,
  };
};

export default useChatHandler;

// TODO: Move findFirstEmoteTrigger and potentially emojiToEmoteMap to a utils file.
// TODO: Consider moving detectAndSaveName logic here as well, or keeping it in ChatConsole if it's purely UI interaction.