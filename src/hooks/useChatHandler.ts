import { useState, useRef, useCallback } from 'react';
import { useAppStore, selectRobotConfig } from '../store/useAppStore';
import type { ServerMessage, ClientChatMessage, ChatMessage, AIMessage } from '../types';
import useWebSocketManager from './useWebSocketManager';
import useTypingAnimator from './useTypingAnimator';
import useSpeechSynthesizer from './useSpeechSynthesizer';
import { findFirstEmoteTrigger } from '../utils/chatUtils'; // <-- Import util

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
  const triggerEmote = useAppStore((store) => store.triggerEmote);
  const robotConfig = useAppStore(selectRobotConfig);
  // Note: We might not need direct access to all store actions/state here
  // if they are only used within the other specialized hooks.

  // --- Instantiate Child Hooks ---
  const { speak, cancelSpeech } = useSpeechSynthesizer();

  const handleAnimationComplete = useCallback(
    (messageId: string, finalText: string) => {
      console.log("[useChatHandler] Animation complete, finalizing:", messageId, finalText);

      // Find and trigger emote using the imported util function
      const detectedEmote = findFirstEmoteTrigger(finalText); // Use imported util
      if (detectedEmote) {
        console.log("[useChatHandler] Triggering emote:", detectedEmote);
        triggerEmote(detectedEmote); // No cast needed now
      }

      // Speak the final text
      speak(finalText, () => {
        console.log("[useChatHandler] Speech finished for:", messageId);
      });

      // Reset message-specific state
      currentBotMessageId.current = null;
      accumulatedBotResponse.current = "";
      // Set processing to false only AFTER animation and speech are done
      setIsBotProcessing(false); // <-- Move setIsBotProcessing here
    },
    [speak, triggerEmote, findFirstEmoteTrigger, setIsBotProcessing] // Add setIsBotProcessing dependency
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
      // console.log("[useChatHandler] Received message:", message); // DEBUG
      switch (message.type) {
        case "processing": {
          setIsBotProcessing(true);
          isStreamCompleteRef.current = false; // <-- Reset stream complete flag
          accumulatedBotResponse.current = "";
          stopAnimation(); // Stop previous animation if any

          const botMessageId = `msg-${Date.now()}-${Math.random()}`;
          const placeholderMessage: ChatMessage = {
            id: botMessageId, sender: "bot", text: "", timestamp: Date.now(),
          };
          addChatMessage(placeholderMessage);
          currentBotMessageId.current = botMessageId;
          startAnimation();
          break;
        }
        case "chunk":
          if (currentBotMessageId.current) {
            accumulatedBotResponse.current += message.payload;
            const charsToAdd = message.payload.split("");
            addToQueue(charsToAdd);
          } else {
            console.warn("[useChatHandler] Received chunk but no active bot message ID");
          }
          break;
        case "idle":
          // console.log("[useChatHandler] Received idle signal."); // DEBUG
          // Signal that the stream is complete, but don't change processing state yet
          isStreamCompleteRef.current = true; // <-- Set stream complete flag
          break;
        case "error":
          console.error("[useChatHandler] Server Error:", message.payload);
          stopAnimation();
          setIsBotProcessing(false);
          if (currentBotMessageId.current) {
            updateMessageText(currentBotMessageId.current, `Error: ${message.payload}`);
          } else {
            addChatMessage({ id: `err-${Date.now()}`, sender: "system", text: `Server Error: ${message.payload}`, timestamp: Date.now() });
          }
          currentBotMessageId.current = null;
          accumulatedBotResponse.current = "";
          break;
        default:
          console.warn("[useChatHandler] Received unknown message type:", message.type);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addChatMessage, updateMessageText, setIsBotProcessing /* Removed animation refs to stabilize callback */]
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
    triggerEmote(null);

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

  }, [isConnected, sendMessage, cancelSpeech, stopAnimation, triggerEmote, robotConfig.personalityCore]);

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