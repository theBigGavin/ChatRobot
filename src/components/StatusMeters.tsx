import React, { useEffect, useState, useRef } from "react";
import {
  useAppStore,
  selectGameState,
  selectRobotState,
} from "../store/useAppStore"; // Import robotState selector

// Helper function to map sync rate (0-100) to pointer rotation (-90 to 90 deg)
const mapSyncRateToRotation = (syncRate: number): number => {
  const clampedRate = Math.max(0, Math.min(100, syncRate)); // Ensure rate is within 0-100
  // Linear mapping: 0 -> -90, 50 -> 0, 100 -> 90
  return (clampedRate / 100) * 180 - 90;
};

// Simple placeholder for a single meter with dynamic pointer and effects
const MeterPlaceholder: React.FC<{
  label: string;
  color?: string;
  gameState: ReturnType<typeof selectGameState>;
  currentValue?: number; // Optional current value for the meter (e.g., syncRate)
}> = ({ label, color = "#888", gameState, currentValue = 0 }) => {
  const [pointerRotation, setPointerRotation] = useState(
    mapSyncRateToRotation(currentValue)
  ); // Initialize with current value
  const [isPeaking, setIsPeaking] = useState(false);
  const peakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSpinning = gameState === "gacha_spinning";
  const isGenerating = gameState === "robot_generating";

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSpinning) {
      // Spinning effect
      setIsPeaking(false);
      intervalId = setInterval(() => {
        setPointerRotation(Math.random() * 180 - 90);
      }, 100);
    } else if (isGenerating) {
      // Peaking effect
      setIsPeaking(true);
      setPointerRotation(90); // Max value during peak
      if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current);
      peakTimeoutRef.current = setTimeout(() => {
        setIsPeaking(false);
        // After peak, set to the actual current value
        setPointerRotation(mapSyncRateToRotation(currentValue));
      }, 400);
    } else {
      // Idle or other states: Reflect the current value
      setIsPeaking(false);
      setPointerRotation(mapSyncRateToRotation(currentValue));
    }

    // Cleanup interval and timeout
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current);
    };
    // Depend on derived states AND currentValue for non-spinning updates
  }, [isSpinning, isGenerating, currentValue]);

  return (
    <div
      style={{
        flex: 1,
        border: `2px solid ${color}`,
        borderRadius: "50%",
        margin: "0 5px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        position: "relative",
        aspectRatio: "1 / 1", // Keep it square
        minWidth: "50px", // Ensure it doesn't get too small
        maxWidth: "80px", // <<< Limit maximum width (adjust as needed)
        overflow: "hidden",
        transition: "box-shadow 0.3s ease",
        boxShadow:
          isSpinning || isPeaking
            ? `0 0 10px 3px ${color}${isPeaking ? "ff" : "aa"}`
            : "none",
      }}
    >
      {/* Pointer with dynamic rotation */}
      <div
        style={{
          width: "2px",
          height: "40%",
          backgroundColor: color,
          position: "absolute",
          bottom: "50%",
          left: "calc(50% - 1px)",
          transformOrigin: "bottom center",
          transform: `rotate(${pointerRotation}deg)`,
          // Apply smooth transition only when not spinning
          transition: isSpinning ? "none" : "transform 0.3s ease-out",
        }}
      ></div>
      {/* Label */}
      <span
        style={{
          fontSize: "xx-small",
          color: "#333",
          marginTop: "auto",
          paddingBottom: "5px",
          zIndex: 1,
        }}
      >
        {label}
      </span>
      {/* Optional: Display value */}
      {/* <span style={{ fontSize: 'xx-small', color: '#555', position: 'absolute', top: '5px', zIndex: 1 }}>{currentValue.toFixed(0)}</span> */}
    </div>
  );
};

const StatusMeters: React.FC = () => {
  const gameState = useAppStore(selectGameState);
  const robotState = useAppStore(selectRobotState); // Get robot state for syncRate

  return (
    <div
      style={{
        border: "1px dashed green",
        padding: "10px",
        margin: "0",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "3px",
      }}
    >
      {/* Pass gameState and relevant values to each meter */}
      {/* TODO: Add actual values for Pressure and Heat later if needed */}
      <MeterPlaceholder
        label="Pressure"
        color="#c0392b"
        gameState={gameState}
        currentValue={50}
      />{" "}
      {/* Example static value */}
      <MeterPlaceholder
        label="Heat"
        color="#f39c12"
        gameState={gameState}
        currentValue={30}
      />{" "}
      {/* Example static value */}
      <MeterPlaceholder
        label="Sync Rate"
        color="#2980b9"
        gameState={gameState}
        currentValue={robotState.syncRate}
      />{" "}
      {/* Use actual syncRate */}
    </div>
  );
};

export default StatusMeters;
