// import { StrictMode } from "react"; // Removed unused import
import { createRoot } from "react-dom/client";
import "./index.css"; // Import the global CSS resets
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode> // Temporarily removed for debugging
  <App />
  // </StrictMode>
);
