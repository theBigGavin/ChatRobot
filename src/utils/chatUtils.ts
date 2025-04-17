import type { EmoteAction } from '../types'; // Import the specific type

// --- Emoji to Emote Mapping ---
// Export this map so it can be used elsewhere if needed, or keep it internal to this util
export const emojiToEmoteMap: Record<string, EmoteAction> = {
  "😊": "smile",
  "🙂": "smile",
  "😄": "laugh",
  "😂": "laugh",
  "🤔": "think",
  "😔": "sad",
  "😞": "sad",
  "👋": "wave",
  "👍": "nod",
  // Add other mappings as needed
};

/**
 * Finds the first relevant emote trigger (Emoji) in a given text.
 * @param text - The text to search within.
 * @returns The corresponding EmoteAction string or null if no trigger is found.
 */
export const findFirstEmoteTrigger = (text: string): EmoteAction | null => {
  for (const emoji in emojiToEmoteMap) {
    if (text.includes(emoji)) {
      // Ensure the value retrieved from the map is a valid EmoteAction
      const potentialEmote = emojiToEmoteMap[emoji];
      // Basic check (could be more robust if needed)
      if (['smile', 'laugh', 'think', 'sad', 'wave', 'nod'].includes(potentialEmote as string)) {
        return potentialEmote;
      }
    }
  }
  return null; // Return null if no valid emote is found
};

// Consider adding stripMarkdown here as well if it's generally useful text processing