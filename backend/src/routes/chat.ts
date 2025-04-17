import { Router, Request, Response } from 'express';
import { callExternalAIService } from '../services/aiService.js'; // Add .js extension
import type { AIMessage } from '../services/aiService.js'; // Add .js extension

const router = Router();

// Define the expected request body structure (adjust based on actual AI service needs)
interface ChatRequestBody {
  userInput: string;
  personalityCore: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userName?: string; // Optional user name
}

// POST /api/chat
router.post('/', async (req: Request, res: Response) => {
  const { userInput, personalityCore, history, userName } = req.body as ChatRequestBody;

  // --- Input Validation (Basic) ---
  if (!userInput || !personalityCore || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Missing required fields: userInput, personalityCore, history' });
  }

  console.log('[Backend /api/chat] Received request:');
  console.log('  User Input:', userInput);
  console.log('  Personality:', personalityCore);
  console.log('  User Name:', userName || 'N/A');
  console.log('  History Length:', history.length);

  try {
    // --- Construct Prompt for AI Service ---
    // This is a placeholder - adapt it based on your chosen AI service's requirements
    const systemPrompt = `You are Cogsworth, a steampunk robot with a ${personalityCore} personality. You are talking to ${userName || 'the user'}. Keep your responses concise and in character.`;

    // Format history for the AI (example for OpenAI-like structure)
    // Add type assertion here to satisfy the AIMessage[] type expected by the service
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history, // Assuming history is already in { role: 'user'|'assistant', content: '...' } format
      // The latest userInput is already included in the history sent from frontend
    ];

    console.log('[Backend /api/chat] Sending messages to AI service...');

    // --- Call External AI Service ---
    const aiResponseText = await callExternalAIService(messages); // Call the actual service

    console.log('[Backend /api/chat] Received AI response:', aiResponseText);

    // --- Send Response to Frontend ---
    res.json({ robotResponse: aiResponseText });

  } catch (error) {
    console.error('[Backend /api/chat] Error processing chat request:', error);
    // Avoid sending detailed internal errors to the client
    res.status(500).json({ error: 'Failed to get response from AI service.' });
  }
});

export default router;