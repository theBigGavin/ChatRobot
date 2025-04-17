import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http'; // Import http module
import { WebSocketServer, WebSocket } from 'ws'; // Import WebSocket classes
import path from 'path'; // Import path using ES module syntax
import { fileURLToPath } from 'url'; // Helper to get __dirname in ES modules
import chatRoutes from './routes/chat.js'; // Add .js extension
import { handleWebSocketConnection } from './services/webSocketHandler.js'; // Add .js extension

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file at the root of the backend project
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Use imported path

const app = express();
const port = process.env.BACKEND_PORT || 3001; // Use a different port for the backend

// --- Middleware ---
// Enable CORS for all origins (adjust for production)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());

// --- HTTP Routes ---
// Use the chat routes for the /api/chat path (can be kept for non-WS fallback or other purposes)
app.use('/api/chat', chatRoutes);

// Simple root route for testing
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// --- Create HTTP Server ---
// Express app itself doesn't handle WebSockets directly, we need an http server
const server = http.createServer(app);

// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ server }); // Attach WebSocket server to the HTTP server

console.log(`[WebSocket] Server is setting up...`);

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');

  // Pass the WebSocket connection to the handler function
  handleWebSocketConnection(ws);

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
});

// --- Start the Server ---
server.listen(port, () => {
  console.log(`[Server] Backend HTTP/WebSocket server listening on port ${port}`);
});

// --- Graceful Shutdown (Optional but Recommended) ---
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM signal received: closing HTTP server');
  wss.close(() => {
    console.log('[WebSocket] Server closed');
  });
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT signal received: closing HTTP server');
  wss.close(() => {
    console.log('[WebSocket] Server closed');
  });
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});