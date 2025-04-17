import { create } from 'zustand';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AppState, RobotConfig, ChatMessage, RobotState, PartType, PartDefinition, GameState, EmoteAction } from '../types';
import { initialPartsLibrary } from '../data/partsLibrary';

// --- Constants ---
const LOCAL_STORAGE_USERNAME_KEY = 'cogsworth_userName'; // Key for localStorage

const PERSONALITY_CORES = [
  'standard', 'optimistic', 'curious', 'logical', 'lazy', 'reserved', 'humorous', 'timid',
];
const SYNC_LEVEL_THRESHOLDS = [0, 25, 50, 75, 100];
// --- End Constants ---

// --- Helper Functions ---
const getDefaultPartId = (type: PartType): string => {
  const parts = initialPartsLibrary.filter(p => p.type === type);
  return parts.length > 0 ? parts[0].id : `default_${type}`;
};

const getRandomPartIdByType = (type: PartType): string => {
  const partsOfType = initialPartsLibrary.filter(part => part.type === type);
  if (partsOfType.length === 0) {
    console.warn(`No parts found for type: ${type}`);
    return `default_${type}`;
  }
  const randomIndex = Math.floor(Math.random() * partsOfType.length);
  return partsOfType[randomIndex].id;
};

const getRandomPersonalityCore = (): string => {
  const randomIndex = Math.floor(Math.random() * PERSONALITY_CORES.length);
  return PERSONALITY_CORES[randomIndex];
};

const calculateSyncLevel = (syncRate: number): number => {
  for (let i = SYNC_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (syncRate >= SYNC_LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
};

// --- Initial State ---
// Function to safely get initial user name from localStorage
const getInitialUserName = (): string | undefined => {
  try {
    return localStorage.getItem(LOCAL_STORAGE_USERNAME_KEY) || undefined;
  } catch (error) {
    console.error("Failed to read username from localStorage:", error);
    return undefined;
  }
};

// Define the initial state values using Omit on the imported AppState type
const initialState: Omit<AppState,
  'setRobotConfig' |
  'addChatMessage' |
  'randomizeRobotConfig' |
  'finishRandomization' |
  'confirmPreviewConfig' |
  'updateSyncRate' |
  'setGameState' |
  'setIsSpeaking' |
  'triggerEmote' |
  'setUserName' |
  'updateMessageText' // <<< Add new action
> = {
  robotConfig: {
    head: getDefaultPartId('head'),
    torso: getDefaultPartId('torso'),
    arms: getDefaultPartId('arms'),
    legs: getDefaultPartId('legs'),
    personalityCore: getRandomPersonalityCore(),
    voiceParams: { rate: 1.0, pitch: 1.0, timbre: 'default' },
  },
  previewRobotConfig: null,
  robotState: {
    syncRate: 0,
    syncLevel: 1,
    memory: {
      userName: getInitialUserName(), // Load initial username
      // Initialize other memory fields if needed
      // recentTopics: [],
      // preferences: [],
    },
  },
  chatHistory: [],
  gameState: 'idle',
  isSpeaking: false,
  currentEmote: null,
  uiSettings: {
    ambientSound: true,
    crtGlowMode: 'medium',
  },
};

// Create the Zustand store using the imported AppState type
export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  // --- Actions ---

  setRobotConfig: (configUpdate) =>
    set((state) => ({
      robotConfig: { ...state.robotConfig, ...configUpdate },
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  randomizeRobotConfig: () =>
    set(() => ({
      gameState: 'gacha_spinning',
      previewRobotConfig: null,
    })),

  finishRandomization: () =>
    set(() => ({
      previewRobotConfig: {
        head: getRandomPartIdByType('head'),
        torso: getRandomPartIdByType('torso'),
        arms: getRandomPartIdByType('arms'),
        legs: getRandomPartIdByType('legs'),
        personalityCore: getRandomPersonalityCore(),
        voiceParams: useAppStore.getState().robotConfig.voiceParams,
      },
      gameState: 'gacha_confirming',
    })),

  confirmPreviewConfig: () =>
    set((state) => {
      if (state.previewRobotConfig) {
        return {
          robotConfig: state.previewRobotConfig,
          previewRobotConfig: null,
          gameState: 'robot_generating',
        };
      }
      return { gameState: 'idle' };
    }),

  updateSyncRate: (amount: number) =>
    set((state) => {
      const newSyncRate = Math.max(0, Math.min(100, state.robotState.syncRate + amount));
      const newSyncLevel = calculateSyncLevel(newSyncRate);
      if (newSyncLevel !== state.robotState.syncLevel) {
        console.log(`Sync Level Up! ${state.robotState.syncLevel} -> ${newSyncLevel}`);
      }
      return {
        robotState: { ...state.robotState, syncRate: newSyncRate, syncLevel: newSyncLevel },
      };
    }),

  setGameState: (newState: GameState) =>
    set(() => ({
      gameState: newState,
    })),

  setIsSpeaking: (speaking: boolean) =>
    set(() => ({
      isSpeaking: speaking,
    })),

  triggerEmote: (emote: EmoteAction) =>
    set(() => ({
      currentEmote: emote,
    })),

  setUserName: (name: string) =>
    set((state) => {
      try {
        localStorage.setItem(LOCAL_STORAGE_USERNAME_KEY, name);
      } catch (error) {
        console.error("Failed to save username to localStorage:", error);
      }
      return {
        robotState: {
          ...state.robotState,
          memory: {
            ...state.robotState.memory,
            userName: name,
          }
        }
      };
    }),

  updateMessageText: (messageId: string, textToAppend: string) => // Rename for clarity
    set((state) => {
      // Log before update
      console.log(`[Zustand DEBUG] updateMessageText called for ID: ${messageId}, Appending: "${textToAppend}"`); // Uncommented
      const newChatHistory = state.chatHistory.map((msg) => {
        if (msg.id === messageId) {
          const updatedText = msg.text + textToAppend;
          console.log(`[Zustand DEBUG] Updating message ${messageId}. Old text: "${msg.text}", New text: "${updatedText}"`); // Uncommented
          return { ...msg, text: updatedText };
        }
        return msg;
      });
      // Log after update (or rather, the state that will be set)
      console.log(`[Zustand DEBUG] New chatHistory length: ${newChatHistory.length}`); // Uncommented
      return { chatHistory: newChatHistory };
    }),

}));

// --- Selectors ---
export const selectRobotConfig = (state: AppState) => state.robotConfig;
export const selectPreviewRobotConfig = (state: AppState) => state.previewRobotConfig;
export const selectChatHistory = (state: AppState) => state.chatHistory;
export const selectRobotState = (state: AppState) => state.robotState;
export const selectGameState = (state: AppState) => state.gameState;
export const selectIsSpeaking = (state: AppState) => state.isSpeaking;
export const selectCurrentEmote = (state: AppState) => state.currentEmote;
export const selectUserName = (state: AppState) => state.robotState.memory.userName; // <<< Add selector for user name