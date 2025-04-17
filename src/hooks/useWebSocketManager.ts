import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientChatMessage } from '../types'; // Assuming types are in ../types

// Define the expected structure for message handlers passed to the hook
interface WebSocketHandlers {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  onMessage?: (message: ServerMessage) => void;
}

// Define the return type of the hook
interface WebSocketManager {
  isConnected: boolean;
  sendMessage: (message: ClientChatMessage) => void;
  connect: () => void; // Function to initiate connection
  disconnect: () => void; // Function to manually disconnect
}

const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_URL = `${WS_PROTOCOL}//${window.location.hostname}:3001`; // Consider making URL configurable

/**
 * Custom Hook to manage WebSocket connection and communication.
 * @param handlers - Callback functions for WebSocket events (onOpen, onClose, onError, onMessage).
 * @returns An object containing connection status and methods to interact with the WebSocket.
 */
const useWebSocketManager = (handlers: WebSocketHandlers): WebSocketManager => {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { onOpen, onClose, onError, onMessage } = handlers; // Destructure handlers

  // --- Connection Logic ---
  const connect = useCallback(() => {
    console.log(`[useWebSocketManager] Attempting to connect to ${WS_URL}...`);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("[useWebSocketManager] Already connected.");
      return;
    }
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log("[useWebSocketManager] Connection established");
      setIsConnected(true);
      onOpen?.(); // Call external handler if provided
    };

    ws.current.onclose = (event) => {
      console.log(`[useWebSocketManager] Connection closed: ${event.code} ${event.reason}`);
      setIsConnected(false);
      ws.current = null; // Clear the ref
      onClose?.(event); // Call external handler

      // Attempt to reconnect after a delay (e.g., 5 seconds)
      // Avoid reconnecting if the close was intentional (e.g., code 1000) or during unmount
      if (event.code !== 1000 && event.code !== 1005) { // 1000 = Normal Closure, 1005 = No Status Received (often during unmount)
        console.log("[useWebSocketManager] Attempting to reconnect in 5 seconds...");
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      }
    };

    ws.current.onerror = (error) => {
      console.error("[useWebSocketManager] Error:", error);
      // Note: The 'onclose' event will usually fire immediately after 'onerror'.
      // We let the onclose handler manage the state and reconnection attempts.
      onError?.(error); // Call external handler
    };

    ws.current.onmessage = (event) => {
      try {
        const serverMessage: ServerMessage = JSON.parse(event.data);
        // console.log("[useWebSocketManager] Received:", serverMessage); // Optional: Log received messages
        onMessage?.(serverMessage); // Pass parsed message to external handler
      } catch (err) {
        console.error("[useWebSocketManager] Error parsing message:", event.data, err);
        // Optionally, call onError or a specific onParseError handler
      }
    };
  }, [WS_URL, onOpen, onClose, onError, onMessage]); // Add handlers to dependencies

  // --- Disconnection Logic ---
  const disconnect = useCallback(() => {
    console.log("[useWebSocketManager] Disconnecting manually...");
    // Clear reconnect timeout if disconnect is called manually
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (ws.current) {
      ws.current.close(1000, "Manual disconnection"); // Use code 1000 for normal closure
      ws.current = null; // Clear ref immediately after initiating close
    }
    setIsConnected(false); // Update state immediately
  }, []);

  // --- Auto-connect on mount and cleanup on unmount ---
  useEffect(() => {
    connect(); // Initial connection attempt

    return () => {
      // Cleanup function: close WebSocket connection when the component unmounts
      disconnect();
    };
  }, [connect, disconnect]); // Depend on connect/disconnect callbacks

  // --- Send Message Function ---
  const sendMessage = useCallback((message: ClientChatMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // console.log("[useWebSocketManager] Sending:", message); // Optional: Log sent messages
      ws.current.send(JSON.stringify(message));
    } else {
      console.error("[useWebSocketManager] Cannot send message: WebSocket is not connected.");
      // Optionally, queue the message or notify the user
    }
  }, []); // No dependencies needed if ws.current is stable

  return { isConnected, sendMessage, connect, disconnect };
};

export default useWebSocketManager;