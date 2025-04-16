import React, { useState, useRef, useEffect } from "react";

// Define the structure for a single message
export interface ChatMessage {
  id: string; // Use a unique ID instead of timestamp for key
  sender: "user" | "bot";
  text: string;
  timestamp: number; // Keep timestamp for sorting/display if needed
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void; // Callback when user sends a message
  isBotTyping?: boolean; // Optional indicator for bot activity
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isBotTyping,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref to scroll to bottom

  // Scroll to the bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
  };

  const handleSendClick = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText(""); // Clear input after sending
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      // Send on Enter, allow Shift+Enter for newline (though input doesn't support it now)
      event.preventDefault(); // Prevent default Enter behavior (like form submission)
      handleSendClick();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#e8e8e8",
        borderTop: "1px solid #ccc",
      }}
    >
      {/* Message Display Area */}
      <div style={{ flexGrow: 1, overflowY: "auto", padding: "15px" }}>
        {messages.map((msg) => (
          <div
            key={msg.id} // Use the unique ID as the key
            style={{
              marginBottom: "10px",
              textAlign: msg.sender === "user" ? "right" : "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "15px",
                backgroundColor: msg.sender === "user" ? "#007bff" : "#f0f0f0",
                color: msg.sender === "user" ? "#fff" : "#333",
                maxWidth: "70%",
                wordWrap: "break-word", // Ensure long words wrap
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {/* Optional typing indicator */}
        {isBotTyping && (
          <div
            style={{
              textAlign: "left",
              fontStyle: "italic",
              color: "#666",
              marginBottom: "10px",
            }}
          >
            Bot is typing...
          </div>
        )}
        {/* Empty div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          display: "flex",
          padding: "10px",
          borderTop: "1px solid #ccc",
          background: "#f8f8f8",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          style={{
            flexGrow: 1,
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            marginRight: "10px",
          }}
          disabled={isBotTyping} // Disable input while bot is "typing"
        />
        <button
          onClick={handleSendClick}
          style={{
            padding: "8px 15px",
            border: "none",
            background: "#007bff",
            color: "#fff",
            borderRadius: "5px",
            cursor: "pointer",
          }}
          disabled={isBotTyping || !inputText.trim()} // Disable button if bot typing or input empty
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
