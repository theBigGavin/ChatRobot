import React, { useEffect, useRef, useState } from "react"; // Import useState
import {
  useAppStore,
  selectPreviewRobotConfig,
  selectGameState,
} from "../store/useAppStore";
import {
  getPartById,
  getPartsByType,
  // initialPartsLibrary, // Removed unused import
} from "../data/partsLibrary"; // Import getPartsByType
import { Howl } from "howler";
import type { PartType } from "../types"; // Import PartType

// --- Sound Definitions ---
const sounds = {
  buttonRedClick: new Howl({
    src: ["assets/sounds/button_red_click.mp3"],
    volume: 0.7,
  }),
  buttonGreenClick: new Howl({
    src: ["assets/sounds/button_green_click.mp3"],
    volume: 0.7,
  }),
  reelSpinLoop: new Howl({
    src: ["assets/sounds/reel_spin_loop.mp3"],
    loop: true,
    volume: 0.5,
  }),
  reelStop: new Howl({ src: ["assets/sounds/reel_stop.mp3"], volume: 0.6 }),
};
// --- End Sound Definitions ---

// Helper to get a random part name for a given type for spinning effect
const getRandomPartNameForSpin = (type: PartType): string => {
  const partsOfType = getPartsByType(type);
  if (partsOfType.length === 0) return "---";
  const randomIndex = Math.floor(Math.random() * partsOfType.length);
  // Return name for visual effect, ID might be too cryptic
  return partsOfType[randomIndex].name.substring(0, 8) + ".."; // Truncate long names
};

const GachaControls: React.FC = () => {
  // Get actions and state from the store
  const randomizeRobotConfig = useAppStore(
    (store) => store.randomizeRobotConfig
  );
  const finishRandomization = useAppStore((store) => store.finishRandomization);
  const confirmPreviewConfig = useAppStore(
    (store) => store.confirmPreviewConfig
  );
  const previewConfig = useAppStore(selectPreviewRobotConfig);
  const gameState = useAppStore(selectGameState);

  // State for spinning display text
  const [spinningDisplayText, setSpinningDisplayText] = useState({
    head: "---",
    torso: "---",
    arms: "---",
    legs: "---",
  });
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for spinning interval
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for spin duration timeout

  // Effect to handle spinning state, sound, and visual effect
  useEffect(() => {
    if (gameState === "gacha_spinning") {
      sounds.reelSpinLoop.play();

      // Start visual spinning effect interval
      spinIntervalRef.current = setInterval(() => {
        setSpinningDisplayText({
          head: getRandomPartNameForSpin("head"),
          torso: getRandomPartNameForSpin("torso"),
          arms: getRandomPartNameForSpin("arms"),
          legs: getRandomPartNameForSpin("legs"),
        });
      }, 75); // Update text rapidly (e.g., every 75ms)

      // Simulate spin duration
      const spinDuration = 2500;
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = setTimeout(() => {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current); // Stop visual spin
        sounds.reelSpinLoop.stop();
        sounds.reelStop.play();
        finishRandomization();
      }, spinDuration);
    } else {
      // Stop sounds and intervals if state is not spinning
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      sounds.reelSpinLoop.stop();
    }

    // Cleanup on unmount or state change
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      sounds.reelSpinLoop.stop();
    };
  }, [gameState, finishRandomization]);

  const getPartDisplay = (partId: string | undefined) => {
    if (!partId) return "---";
    const part = getPartById(partId);
    return part ? part.name : partId;
  };

  const handleRandomizeClick = () => {
    if (gameState === "idle" || gameState === "gacha_confirming") {
      console.log("Starting Gacha Sequence...");
      sounds.buttonRedClick.play();
      randomizeRobotConfig();
    }
  };

  const handleConfirmClick = () => {
    if (gameState === "gacha_confirming" && previewConfig) {
      console.log("Confirming preview config...");
      sounds.buttonGreenClick.play();
      confirmPreviewConfig();
    }
  };

  const isSpinning = gameState === "gacha_spinning";
  const canConfirm = gameState === "gacha_confirming" && !!previewConfig;
  const canStart = gameState === "idle" || gameState === "gacha_confirming";

  return (
    <div
      style={{
        border: "1px dashed blue", // Keep dashed border for now
        padding: "10px",
        margin: "0",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "3px",
      }}
    >
      <p
        style={{
          margin: "0 0 10px 0",
          textAlign: "center",
          color: "#1a1a1a",
          fontSize: "small",
          fontWeight: "bold",
        }}
      >
        Gacha Controls
      </p>

      {/* Display preview selection or spinning indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: "100%",
          marginBottom: "10px",
          background: "#ccc",
          color: "#000",
          padding: "5px",
          boxSizing: "border-box",
          minHeight: "25px",
          borderRadius: "2px",
          fontFamily: "monospace",
          overflow: "hidden", // Hide overflow during spin if needed
        }}
      >
        {isSpinning ? (
          <>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              {spinningDisplayText.head}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              {spinningDisplayText.torso}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              {spinningDisplayText.arms}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              {spinningDisplayText.legs}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              H: {getPartDisplay(previewConfig?.head)}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              T: {getPartDisplay(previewConfig?.torso)}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              A: {getPartDisplay(previewConfig?.arms)}
            </div>
            <div
              style={{
                border: "1px solid #999",
                padding: "2px 5px",
                fontSize: "x-small",
                background: "#eee",
                minWidth: "50px",
                textAlign: "center",
              }}
            >
              L: {getPartDisplay(previewConfig?.legs)}
            </div>
          </>
        )}
      </div>

      {/* Buttons with updated logic and styles */}
      <div style={{ marginTop: "auto" }}>
        <button
          onClick={handleRandomizeClick}
          disabled={!canStart || isSpinning}
          style={{
            backgroundColor: "#c0392b",
            color: "#f0e0d0",
            padding: "8px 15px",
            marginRight: "10px",
            border: "2px solid #5a2d0c",
            borderRadius: "3px",
            cursor: !canStart || isSpinning ? "not-allowed" : "pointer",
            fontWeight: "bold",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            textShadow: "1px 1px 1px rgba(0,0,0,0.4)",
            opacity: !canStart || isSpinning ? 0.6 : 1,
          }}
        >
          启动序列
        </button>
        <button
          onClick={handleConfirmClick}
          disabled={!canConfirm || isSpinning}
          style={{
            backgroundColor: canConfirm ? "#27ae60" : "#7f8c8d",
            color: "#f0e0d0",
            padding: "8px 15px",
            border: `2px solid ${canConfirm ? "#16a085" : "#596061"}`,
            borderRadius: "3px",
            cursor: !canConfirm || isSpinning ? "not-allowed" : "pointer",
            fontWeight: "bold",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            textShadow: "1px 1px 1px rgba(0,0,0,0.4)",
            opacity: !canConfirm || isSpinning ? 0.6 : 1,
          }}
        >
          确认生成
        </button>
      </div>
    </div>
  );
};

export default GachaControls;
