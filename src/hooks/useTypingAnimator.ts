import { useRef, useCallback, useEffect } from 'react';

// Define parameters expected by the hook
interface TypingAnimatorParams {
  // Use Refs for messageId and accumulatedResponse
  messageIdRef: React.RefObject<string | null>;
  accumulatedResponseRef: React.RefObject<string>;
  isStreamCompleteRef: React.RefObject<boolean>; // <-- Add ref to track stream completion
  updateMessageText: (messageId: string, char: string) => void; // Action to append text
  onAnimationComplete: (messageId: string, finalText: string) => void; // Callback when animation finishes
  averageCharTime?: number; // Optional typing speed override
}

// Define the return type of the hook
interface TypingAnimator {
  startAnimation: () => void; // Function to start the animation loop
  stopAnimation: () => void; // Function to stop the animation loop
  addToQueue: (chars: string[]) => void; // Function to add characters to the queue
}

const DEFAULT_AVG_CHAR_TIME = 50; // Default typing speed

/**
 * Custom Hook to manage the typing animation effect for chat messages.
 */
const useTypingAnimator = ({
  // Destructure refs
  messageIdRef,
  accumulatedResponseRef,
  updateMessageText,
  onAnimationComplete,
  averageCharTime = DEFAULT_AVG_CHAR_TIME,
  isStreamCompleteRef, // <-- Destructure the new ref
}: TypingAnimatorParams): TypingAnimator => {
  const characterQueueRef = useRef<string[]>([]);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalizationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for finalization timeout

  // --- Stop Animation Logic ---
  const stopAnimation = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
      // console.log("[useTypingAnimator] Animation loop stopped."); // DEBUG
    }
    // Also clear finalization timeout
    if (finalizationTimeoutRef.current) {
      clearTimeout(finalizationTimeoutRef.current);
      finalizationTimeoutRef.current = null;
      // console.log("[useTypingAnimator] Finalization timeout cleared."); // DEBUG
    }
  }, []);

  // --- Animation Loop Logic ---
  const animationLoop = useCallback(() => {
    // Process Queue
    const currentMessageId = messageIdRef.current; // Read ref inside loop
    if (characterQueueRef.current.length > 0) {
      if (!currentMessageId) { // Use ref value
        console.warn("[useTypingAnimator] Queue has items but no messageId. Stopping.");
        stopAnimation();
        characterQueueRef.current = []; // Clear queue
        return;
      }
      const charToRender = characterQueueRef.current.shift();
      if (charToRender) {
        // console.log(`[useTypingAnimator] Rendering char: ${charToRender}`); // DEBUG
        updateMessageText(currentMessageId, charToRender); // Use ref value
      }
      animationTimeoutRef.current = setTimeout(animationLoop, averageCharTime);
    }
    // Queue Empty Logic
    else {
      if (isStreamCompleteRef.current) { // <-- Check the stream complete ref instead of isProcessing
        // Stream finished AND queue is empty. Schedule finalization check.
        console.log("[useTypingAnimator] Queue empty and stream is complete. Scheduling finalization check.");
        // Clear any pending finalization check first
        if (finalizationTimeoutRef.current) {
          clearTimeout(finalizationTimeoutRef.current);
        }
        // Schedule the check after a short delay
        finalizationTimeoutRef.current = setTimeout(finalizeAnimation, 100); // 100ms delay

        // Stop the animation *loop* timeout, but don't call the main stopAnimation yet
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
          animationTimeoutRef.current = null;
        }
        return; // Don't schedule another animationLoop check immediately
      } else {
        // Queue is empty, but stream is potentially ongoing. Wait.
        // console.log("[useTypingAnimator] Queue empty, but stream is not complete. Waiting..."); // DEBUG
        animationTimeoutRef.current = setTimeout(animationLoop, 50); // Check again soon
      }
    }
  }, [
    // Remove messageId and accumulatedResponse from deps as we use refs now
    updateMessageText,
    onAnimationComplete, // <-- Keep onAnimationComplete
    averageCharTime,
    stopAnimation,
    // Add refs to dependencies (although reading .current doesn't strictly require it, it's safer)
    messageIdRef,
    accumulatedResponseRef,
    isStreamCompleteRef, // <-- Add new ref to dependencies
  ]);

  // --- Start Animation Logic ---
  const startAnimation = useCallback(() => {
    console.log("[useTypingAnimator] Scheduling animation loop start..."); // DEBUG
    stopAnimation(); // Clear previous loop AND finalization timeout if any
    // Use setTimeout to ensure state updates have likely processed
    animationTimeoutRef.current = setTimeout(animationLoop, 0); // Schedule with minimal delay, store ref
  }, [animationLoop, stopAnimation]);

  // --- Add to Queue Logic ---
  const addToQueue = useCallback((chars: string[]) => {
    characterQueueRef.current.push(...chars);
    // console.log(`[useTypingAnimator] Added ${chars.length} chars. New queue length: ${characterQueueRef.current.length}`); // DEBUG
    // If the loop is waiting (timeout scheduled), it will pick up the new chars.
    // If the loop was stopped (e.g., finished previous message), startAnimation needs to be called again.
  }, []);

  // --- Finalization Logic (extracted) ---
  const finalizeAnimation = useCallback(() => {
    console.log("[useTypingAnimator] Performing delayed finalization check.");
    const finalMessageId = messageIdRef.current;
    const finalAccumulatedResponse = accumulatedResponseRef.current;
    if (finalMessageId && finalAccumulatedResponse) {
      console.log(`[useTypingAnimator] Finalizing message ${finalMessageId} with content.`);
      onAnimationComplete(finalMessageId, finalAccumulatedResponse);
    } else {
      console.log(`[useTypingAnimator] Finalizing skipped after delay: missing messageId (${finalMessageId}) or accumulatedResponse (${finalAccumulatedResponse}).`);
    }
    // Ensure everything is stopped after finalization attempt
    stopAnimation();
  }, [messageIdRef, accumulatedResponseRef, onAnimationComplete, stopAnimation]);


  // --- Cleanup on Unmount ---
  useEffect(() => {
    // Ensure the animation loop is stopped when the component using the hook unmounts
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);


  return { startAnimation, stopAnimation, addToQueue };
};

export default useTypingAnimator;