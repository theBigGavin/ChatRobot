import { useCallback, useRef, useEffect } from 'react'; // Removed useState
import { useAppStore, selectRobotConfig } from '../store/useAppStore'; // Import Zustand store/selectors
// import { stripMarkdown } from '../utils/textUtils'; // Removed incorrect import

// Define parameters for the hook (optional, if configuration is needed)
interface SpeechSynthesizerParams {
  defaultLang?: string;
}

// Define the return type of the hook
interface SpeechSynthesizer {
  speak: (text: string, onEndCallback?: () => void) => void;
  cancelSpeech: () => void;
  isSpeaking: boolean; // Provide speaking status
}

/**
 * Custom Hook to manage speech synthesis using the Web Speech API.
 */
const useSpeechSynthesizer = ({
  defaultLang = 'en-US',
}: SpeechSynthesizerParams = {}): SpeechSynthesizer => {
  // Get necessary state/actions from Zustand
  const robotConfig = useAppStore(selectRobotConfig);
  const setIsSpeaking = useAppStore((store) => store.setIsSpeaking);
  const isSpeaking = useAppStore((store) => store.isSpeaking); // Get current speaking state

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Cancel Speech Logic ---
  const cancelSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      // console.log("[useSpeechSynthesizer] Cancelling speech"); // DEBUG
      window.speechSynthesis.cancel();
      // Reset speaking state if speech was actively cancelled
      if (utteranceRef.current) {
        setIsSpeaking(false);
        utteranceRef.current = null;
      }
    }
  }, [setIsSpeaking]);

  // --- Speak Logic ---
  const speak = useCallback(
    (text: string, onEndCallback?: () => void) => {
      if (!('speechSynthesis' in window)) {
        console.warn("Web Speech Synthesis API not supported.");
        onEndCallback?.();
        return;
      }

      cancelSpeech(); // Cancel any previous speech first

      const plainText = stripMarkdown(text);
      if (!plainText) {
        // console.log("[useSpeechSynthesizer] No text to speak after stripping markdown."); // DEBUG
        onEndCallback?.();
        return;
      }

      // console.log(`[useSpeechSynthesizer] Attempting to speak: "${plainText.substring(0, 50)}..."`); // DEBUG

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = defaultLang; // Use default or potentially detected language
      utterance.rate = robotConfig.voiceParams.rate || 1.0;
      utterance.pitch = robotConfig.voiceParams.pitch || 1.0;

      utterance.onstart = () => {
        // console.log("[useSpeechSynthesizer] Speech started."); // DEBUG
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        // console.log("[useSpeechSynthesizer] Speech ended."); // DEBUG
        setIsSpeaking(false);
        utteranceRef.current = null;
        onEndCallback?.();
      };

      utterance.onerror = (event) => {
        console.error("[useSpeechSynthesizer] Speech synthesis error:", event.error);
        setIsSpeaking(false);
        utteranceRef.current = null;
        onEndCallback?.();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [
      cancelSpeech,
      defaultLang,
      robotConfig.voiceParams,
      setIsSpeaking,
      // stripMarkdown should be stable if defined outside or imported
    ]
  );

  // --- Cleanup on Unmount ---
  useEffect(() => {
    // Ensure any ongoing speech is cancelled when the component unmounts
    return () => {
      cancelSpeech();
    };
  }, [cancelSpeech]);


  return { speak, cancelSpeech, isSpeaking };
};

// Helper function (consider moving to a utils file like src/utils/textUtils.ts)
// We keep it here for now to avoid creating another file immediately
const stripMarkdown = (text: string): string => {
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2"); // Bold
  text = text.replace(/(\*|_)(.*?)\1/g, "$2"); // Italic
  text = text.replace(/^#+\s*/gm, ""); // Headers
  text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1"); // Links
  text = text.replace(/`(.*?)`/g, "$1"); // Inline code
  text = text.replace(/```[\s\S]*?```/g, ""); // Code blocks
  text = text.replace(/^(---|___|\*\*\*)\s*$/gm, ""); // Horizontal rules
  text = text.replace(/^>\s*/gm, ""); // Blockquotes
  text = text.replace(/^(\*|-|\+)\s+/gm, ""); // List items
  text = text.replace(/\n{2,}/g, "\n"); // Reduce multiple newlines
  return text.trim();
};


export default useSpeechSynthesizer;