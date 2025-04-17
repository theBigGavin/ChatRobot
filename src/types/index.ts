// Define the possible types for robot parts
export type PartType = 'head' | 'torso' | 'arms' | 'legs';

// Define the possible rarity levels for parts
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

// Define the structure for a single part definition
export interface PartDefinition {
  id: string; // Unique identifier for the part (e.g., 'head_placeholder_a')
  name: string; // Display name (e.g., 'Placeholder Head A')
  type: PartType; // Type of the part
  modelPath: string; // Path to the 3D model file (glTF)
  rarity: Rarity; // Rarity level
  tags?: string[]; // Optional descriptive tags (e.g., ['Brass', 'Heavy Duty'])
}

// Define the structure for voice parameters
export interface VoiceParams {
  rate: number; // Speech rate (e.g., 1.0)
  pitch: number; // Speech pitch (e.g., 1.0)
  timbre: string; // Identifier for the voice timbre/quality (specific to TTS)
}

// Define the structure for the current robot configuration
export interface RobotConfig {
  head: string; // ID of the selected head part
  torso: string; // ID of the selected torso part
  arms: string; // ID of the selected arms part
  legs: string; // ID of the selected legs part
  personalityCore: string; // Identifier for the robot's personality (e.g., 'optimistic')
  voiceParams: VoiceParams; // Voice parameters
  // color?: string; // Optional: If color customization is added later
}

// Define the structure for chat messages
export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system'; // Add 'system' sender for command feedback
  text: string;
  timestamp: number;
}

// Define the structure for AI message history (compatible with backend)
export interface AIMessage {
  role: 'user' | 'assistant'; // System messages are handled differently
  content: string;
}

// Define the structure for the robot's state (including sync rate, memory)
export interface RobotState {
  syncRate: number; // 0-100
  syncLevel: number; // 1-5 based on syncRate thresholds
  memory: {
    userName?: string; // Store user's name
    recentTopics?: string[];
    preferences?: string[];
  };
}

// Define possible game states
export type GameState = 'idle' | 'gacha_spinning' | 'gacha_confirming' | 'robot_generating' | 'chatting';

// Define possible emote action names (map from Emoji)
export type EmoteAction = 'smile' | 'laugh' | 'think' | 'sad' | 'wave' | 'nod' | null;

// Define the structure for the main application state AND actions
export interface AppState {
  // State properties
  robotConfig: RobotConfig;
  previewRobotConfig: RobotConfig | null;
  robotState: RobotState;
  chatHistory: ChatMessage[];
  gameState: GameState;
  isSpeaking: boolean;
  currentEmote: EmoteAction;
  uiSettings: {
    ambientSound: boolean;
    crtGlowMode: string;
    // other settings...
  };

  // Action methods signatures
  setRobotConfig: (configUpdate: Partial<RobotConfig>) => void;
  addChatMessage: (message: ChatMessage) => void;
  randomizeRobotConfig: () => void;
  finishRandomization: () => void;
  confirmPreviewConfig: () => void;
  updateSyncRate: (amount: number) => void;
  setGameState: (newState: GameState) => void;
  setIsSpeaking: (speaking: boolean) => void;
  triggerEmote: (emote: EmoteAction) => void;
  setUserName: (name: string) => void;
  updateMessageText: (messageId: string, newText: string) => void; // <<< ADDED action signature
  // other actions...
}

// --- WebSocket Message Types ---

// Define the structure of messages received from the server via WebSocket
export interface ServerMessage {
  type: "chunk" | "error" | "fullResponse" | "processing" | "idle";
  payload: string;
}

// Define the structure of messages sent to the server via WebSocket
export interface ClientChatMessage {
  type: "chat";
  payload: {
    userInput: string;
    personalityCore: string;
    history: AIMessage[]; // Re-use AIMessage type defined above
    userName?: string;
  };
}