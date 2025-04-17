import React, { useState, KeyboardEvent, useEffect, useRef } from "react";
import {
  useAppStore,
  selectChatHistory,
  selectRobotConfig,
  selectGameState,
  selectIsSpeaking,
  // selectUserName, // Removed as it's no longer used directly
  // Import the new action hook
} from "../store/useAppStore";
import type { ChatMessage, EmoteAction } from "../types";
import { Howl } from "howler";

// --- Sound Definitions ---
const sounds = {
  typeKey: new Howl({ src: ["assets/sounds/key_press.mp3"], volume: 0.5 }),
  sendMessage: new Howl({
    src: ["assets/sounds/send_message.mp3"],
    volume: 0.6,
  }),
  printChar: new Howl({
    src: ["assets/sounds/print_char.mp3"],
    volume: 0.4,
    sprite: { char: [0, 50] },
  }),
  commandSuccess: new Howl({
    src: ["assets/sounds/command_success.mp3"],
    volume: 0.7,
  }), // Sound for command
};
// --- End Sound Definitions ---

// --- Emoji to Emote Mapping ---
const emojiToEmoteMap: Record<string, EmoteAction> = {
  "😊": "smile",
  "🙂": "smile",
  "😄": "laugh",
  "😂": "laugh",
  "🤔": "think",
  "😔": "sad",
  "😞": "sad",
  "👋": "wave",
  "👍": "nod",
};
// --- End Emoji Mapping ---

// CSS for blinking cursor effect
const cursorBlinkStyle = `
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.blinking-cursor::after { content: '█'; animation: blink 1s step-end infinite; margin-left: 1px; visibility: visible; }
.blinking-cursor-hidden::after { visibility: hidden; }
`;

// Helper function to strip basic Markdown
const stripMarkdown = (text: string): string => {
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/^#+\s*/gm, "");
  text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1");
  text = text.replace(/`(.*?)`/g, "$1");
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/^(---|___|\*\*\*)\s*$/gm, "");
  text = text.replace(/^>\s*/gm, "");
  text = text.replace(/^(\*|-|\+)\s+/gm, "");
  text = text.replace(/\n{2,}/g, "\n");
  return text.trim();
};

// Helper function to find the first relevant Emoji
const findFirstEmoteTrigger = (text: string): EmoteAction | null => {
  for (const emoji in emojiToEmoteMap) {
    if (text.includes(emoji)) return emojiToEmoteMap[emoji];
  }
  return null;
};

const ChatConsole: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const addChatMessage = useAppStore((store) => store.addChatMessage);
  const updateSyncRate = useAppStore((store) => store.updateSyncRate);
  const triggerEmote = useAppStore((store) => store.triggerEmote);
  const setUserName = useAppStore((store) => store.setUserName);
  const updateMessageText = useAppStore((store) => store.updateMessageText); // <<< Get the new action
  const chatHistory = useAppStore(selectChatHistory);
  const robotConfig = useAppStore(selectRobotConfig);
  const gameState = useAppStore(selectGameState);
  const isSpeaking = useAppStore(selectIsSpeaking);
  const setIsSpeaking = useAppStore((store) => store.setIsSpeaking);
  // const userName = useAppStore(selectUserName); // Removed: Get latest name directly in sendMessageAndGetResponse
  const historyEndRef = useRef<HTMLDivElement>(null);
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);
  useEffect(() => {
    if (gameState === "idle" && !isBotProcessing) inputRef.current?.focus();
  }, [isBotProcessing, gameState]);

  // Function to simulate streaming text effect
  const streamText = (
    messageId: string,
    fullText: string,
    callback?: () => void
  ) => {
    let currentIndex = 0;
    const averageCharTime = 50;
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    streamIntervalRef.current = setInterval(() => {
      currentIndex++;
      const currentText = fullText.substring(0, currentIndex);
      // Call the action to update the specific message text
      updateMessageText(messageId, currentText);
      // Removed direct setState call
      if (currentIndex >= fullText.length) {
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        callback?.();
      }
    }, averageCharTime);
  };

  // Function to speak text using Web Speech API
  const speak = (text: string, onEndCallback?: () => void) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const plainText = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = "en-US";
      utterance.rate = robotConfig.voiceParams.rate || 1.0;
      utterance.pitch = robotConfig.voiceParams.pitch || 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
        onEndCallback?.();
      };
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        utteranceRef.current = null;
        onEndCallback?.();
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Web Speech Synthesis API not supported.");
      onEndCallback?.();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  const sendMessageAndGetResponse = async (userText: string) => {
    setIsBotProcessing(true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    triggerEmote(null);

    // Get the latest user name and history from the store *right before* the API call
    const currentUserName =
      useAppStore.getState().robotState.memory.userName || "User";
    const currentChatHistory = useAppStore.getState().chatHistory;
    const apiHistory = currentChatHistory.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));
    apiHistory.push({ role: "user", content: userText });

    const botMessageId = `msg-${Date.now()}-${Math.random()}`;
    const placeholderMessage: ChatMessage = {
      id: botMessageId,
      sender: "bot",
      text: "",
      timestamp: Date.now(),
    };
    addChatMessage(placeholderMessage);

    let streamFinished = false;
    let speechFinished = false;
    const checkCompletion = () => {
      if (streamFinished && speechFinished) setIsBotProcessing(false);
    };

    try {
      console.log("Sending to API:", {
        userText,
        personality: robotConfig.personalityCore,
        userName: currentUserName,
      });
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: userText,
          personalityCore: robotConfig.personalityCore,
          history: apiHistory.slice(-10),
          userName: currentUserName,
        }), // Send user name
      });
      if (!response.ok)
        throw new Error(`API request failed with status ${response.status}`);
      const data = await response.json();
      const botReplyText =
        data.robotResponse || "Sorry, I couldn't get a response.";
      console.log("Bot response received:", botReplyText);
      const detectedEmote = findFirstEmoteTrigger(botReplyText);
      if (detectedEmote) {
        console.log("Triggering emote:", detectedEmote);
        triggerEmote(detectedEmote);
      }
      streamText(botMessageId, botReplyText, () => {
        streamFinished = true;
        checkCompletion();
      });
      speak(botReplyText, () => {
        speechFinished = true;
        checkCompletion();
      });
    } catch (error) {
      console.error("Error fetching bot response:", error);
      const errorText = `Error: ${(error as Error).message}`;
      useAppStore.setState((state) => ({
        chatHistory: state.chatHistory.map((msg) =>
          msg.id === botMessageId ? { ...msg, text: errorText } : msg
        ),
      }));
      setIsBotProcessing(false);
      setIsSpeaking(false);
    }
  };

  // Removed handleCommand function as we'll use natural language detection

  // Function to detect if the user is stating their name
  const detectAndSaveName = (text: string): boolean => {
    const namePatterns = [
      /my name is ([\w\s]+)/i,
      /i'm ([\w\s]+)/i,
      /i am ([\w\s]+)/i,
      /call me ([\w\s]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      // Ensure the match is not just "I'm" or "I am" without a name following
      if (match && match[1] && match[1].trim().length > 0) {
        const detectedName = match[1].trim();
        setUserName(detectedName);
        // Add a system message to confirm
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now()}-system`,
          sender: "system",
          text: `Okay, I'll remember your name is ${detectedName}.`,
          timestamp: Date.now(),
        };
        addChatMessage(systemMessage);
        sounds.commandSuccess.play(); // Reuse command success sound
        console.log(`Username detected and set to: ${detectedName}`);
        return true; // Name detected and saved
      }
    }
    return false; // No name detected
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") sounds.typeKey.play();

    if (
      event.key === "Enter" &&
      inputValue.trim() &&
      !isBotProcessing &&
      gameState === "idle"
    ) {
      event.preventDefault();
      const inputText = inputValue.trim();
      setInputValue(""); // Clear input immediately

      // Add user message to history FIRST
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: "user",
        text: inputText,
        timestamp: Date.now(),
      };
      addChatMessage(userMessage);

      // Check if the user stated their name
      const nameWasSet = detectAndSaveName(inputText);

      // If name was set, don't send this specific message to AI (optional, avoids redundant processing)
      // Or, always send to AI regardless. Let's send it for now.
      // if (nameWasSet) {
      //   return;
      // }

      // Play send sound only if it wasn't a name-setting message (or play always?)
      if (!nameWasSet) {
        sounds.sendMessage.play();
      }

      // Always increase sync rate and send to AI
      const syncIncreaseAmount = 0.5;
      updateSyncRate(syncIncreaseAmount);
      console.log(`Sync rate increased by ${syncIncreaseAmount}`);
      sendMessageAndGetResponse(inputText);
    }
  };

  const isInputDisabled = isBotProcessing || gameState !== "idle";

  // Removed debug log
  // console.log("Rendering ChatConsole, chatHistory:", chatHistory);

  return (
    <div
      style={{
        border: "1px dashed red",
        padding: "10px",
        margin: "0",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "3px",
      }}
    >
      <style>{cursorBlinkStyle}</style>
      <p
        style={{
          margin: "0 0 5px 0",
          textAlign: "center",
          color: "#1a1a1a",
          fontSize: "small",
          fontWeight: "bold",
        }}
      >
        Chat Console
      </p>
      <div
        style={{
          flex: 1,
          background: "#000",
          color: "#00FF00",
          fontFamily: "monospace",
          marginBottom: "5px",
          overflowY: "auto",
          border: "1px solid #333",
          padding: "5px",
        }}
      >
        {chatHistory.map(
          (
            message // Restore original map structure without log
          ) => (
            <div
              key={message.id}
              style={{
                marginBottom: "3px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {message.sender === "user" && (
                <span>
                  <span style={{ color: "#aaa" }}>{"⚙>"}</span> {message.text}
                </span>
              )}
              {message.sender === "bot" && (
                <span>
                  <span style={{ color: "#aaa" }}>{"⚡:"}</span> {message.text}
                </span>
              )}
              {message.sender === "system" && (
                <span style={{ color: "#ffcc00" }}>* {message.text} *</span>
              )}{" "}
              {/* System message style */}
            </div>
          )
        )}
        {isBotProcessing && !isSpeaking && (
          <div style={{ color: "#aaa", fontStyle: "italic" }}>
            Bot is processing/streaming...
          </div>
        )}
        {isSpeaking && (
          <div style={{ color: "#aaa", fontStyle: "italic" }}>
            Bot is speaking...
          </div>
        )}
        <div ref={historyEndRef} />
      </div>
      <div
        style={{
          height: "30px",
          background: "#000",
          display: "flex",
          alignItems: "center",
          border: "1px solid #333",
          paddingLeft: "5px",
        }}
      >
        <span style={{ color: "#00FF00", fontFamily: "monospace" }}>
          {"⚙>"}
        </span>
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder=""
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isInputDisabled}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "transparent",
              padding: "0 5px",
              boxSizing: "border-box",
              color: "#00FF00",
              fontFamily: "monospace",
              outline: "none",
              cursor: isInputDisabled ? "not-allowed" : "text",
            }}
          />
          <span
            className={
              !isInputDisabled ? "blinking-cursor" : "blinking-cursor-hidden"
            }
            style={{
              position: "absolute",
              left: `${inputValue.length * 0.6 + 1.5}em`,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "#00FF00",
              lineHeight: 1,
            }}
          ></span>
        </div>
      </div>
    </div>
  );
};

export default ChatConsole;
