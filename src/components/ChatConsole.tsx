import React, {
  useState, // Keep for inputValue
  KeyboardEvent, // Keep for handleKeyDown
  useEffect, // Keep for scrolling and focusing
  useRef, // Keep for historyEndRef and inputRef
  // useCallback, // Remove if no longer needed after refactor
} from "react";
import {
  useAppStore,
  selectChatHistory,
  // selectRobotConfig, // Moved to useChatHandler
  selectGameState,
} from "../store/useAppStore";
import type {
  ChatMessage,
  // EmoteAction, // No longer needed here
  // AIMessage, // No longer needed here
  // ServerMessage, // No longer needed directly
  // ClientChatMessage, // No longer needed directly
} from "../types";
import { Howl } from "howler";
import useChatHandler from "../hooks/useChatHandler"; // <-- Import the main handler hook

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
  }),
};
// --- End Sound Definitions ---

// --- Emoji to Emote Mapping (Moved to utils) ---

// CSS for blinking cursor effect
const cursorBlinkStyle = `
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.blinking-cursor::after { content: '█'; animation: blink 1s step-end infinite; margin-left: 1px; visibility: visible; }
.blinking-cursor-hidden::after { visibility: hidden; }
`;

// Helper function to strip basic Markdown (Moved)

// Helper function to find the first relevant Emoji (Moved)

// --- WebSocket Configuration (Moved) ---

const ChatConsole: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const addChatMessage = useAppStore((store) => store.addChatMessage);
  const updateSyncRate = useAppStore((store) => store.updateSyncRate);
  // const triggerEmote = useAppStore((store) => store.triggerEmote); // Moved
  const setUserName = useAppStore((store) => store.setUserName); // Keep for detectAndSaveName
  // const updateMessageText = useAppStore((store) => store.updateMessageText); // Moved
  const chatHistory = useAppStore(selectChatHistory); // Keep for UI rendering
  // const robotConfig = useAppStore(selectRobotConfig); // Moved to useChatHandler
  const gameState = useAppStore(selectGameState); // Keep for UI logic (focus, disable)
  const historyEndRef = useRef<HTMLDivElement>(null); // Keep for scrolling
  const inputRef = useRef<HTMLInputElement>(null); // Keep for focusing input
  const currentBotMessageId = useRef<string | null>(null); // Keep for cursor logic - TODO: Consider moving this state into useChatHandler too

  // --- Instantiate the Main Chat Handler Hook ---
  const { isConnected, isBotProcessing, submitUserMessage } = useChatHandler();

  // --- Removed Old Hooks Instantiation ---
  // --- Removed Old Callbacks (handleAnimationComplete, handleWebSocketMessage) ---
  // --- Removed Old Functions (sendMessageToServer) ---
  // const ws = useRef<WebSocket | null>(null); // <-- Remove old ws ref
  // const [isConnected, setIsConnected] = useState(false); // <-- Remove old isConnected state
  // Remove local state for streaming text
  // const [streamingDisplayText, setStreamingDisplayText] = useState<string>("");

  // --- Removed Old Logic Sections ---

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (gameState === "idle" && !isBotProcessing && isConnected)
      inputRef.current?.focus();
  }, [isBotProcessing, gameState, isConnected]);

  // --- Removed sendMessageToServer function ---

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
      if (match && match[1] && match[1].trim().length > 0) {
        const detectedName = match[1].trim();
        setUserName(detectedName);
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now()}-system`,
          sender: "system",
          text: `Okay, I'll remember your name is ${detectedName}.`,
          timestamp: Date.now(),
        };
        addChatMessage(systemMessage);
        sounds.commandSuccess.play();
        console.log(`Username detected and set to: ${detectedName}`);
        return true;
      }
    }
    return false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") sounds.typeKey.play();

    if (
      event.key === "Enter" &&
      inputValue.trim() &&
      !isBotProcessing && // Get state from useChatHandler
      isConnected && // Get state from useChatHandler
      gameState === "idle"
    ) {
      event.preventDefault();
      const inputText = inputValue.trim();
      setInputValue(""); // Clear local input state

      // Add user message to history (Keep this here for immediate UI update)
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: "user",
        text: inputText,
        timestamp: Date.now(),
      };
      addChatMessage(userMessage);

      // Detect name (Keep this UI-related logic here for now)
      const nameWasSet = detectAndSaveName(inputText);
      if (!nameWasSet) sounds.sendMessage.play();

      // Update sync rate (Keep this UI-related logic here for now)
      const syncIncreaseAmount = 0.5;
      updateSyncRate(syncIncreaseAmount);
      console.log(`Sync rate increased by ${syncIncreaseAmount}`);

      // Submit message using the handler hook
      submitUserMessage(inputText); // Use function from useChatHandler
    }
  };

  const isInputDisabled =
    isBotProcessing || gameState !== "idle" || !isConnected;

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
        Chat Console{" "}
        {!isConnected && <span style={{ color: "red" }}>(Disconnected)</span>}
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
        {chatHistory.map((message) => (
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
                <span style={{ color: "#aaa" }}>{"⚡:"}</span>{" "}
                {/* Always display text from the global store */}
                {message.text}
                {/* Show cursor only while processing and ID matches */}
                {message.id === currentBotMessageId.current &&
                  isBotProcessing && <span className="blinking-cursor"></span>}
              </span>
            )}
            {message.sender === "system" && (
              <span style={{ color: "#ffcc00" }}>* {message.text} *</span>
            )}
          </div>
        ))}
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
            placeholder={
              !isConnected
                ? "Connecting..."
                : isBotProcessing
                ? "Bot processing..."
                : "Type your message..."
            }
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
        </div>
      </div>
    </div>
  );
};

export default ChatConsole;
