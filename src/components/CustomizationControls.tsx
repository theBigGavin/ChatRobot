import React from "react";

// Define the structure for robot configuration (can be moved to a types file later)
export interface RobotConfig {
  head: string;
  torso: string;
  arms: string;
  legs: string;
  color: string;
}

// Define the props the component will receive
interface CustomizationControlsProps {
  config: RobotConfig;
  headOptions: string[];
  torsoOptions: string[];
  armOptions: string[];
  legOptions: string[];
  colorOptions: string[];
  onCycleOption: (part: keyof RobotConfig, options: string[]) => void;
  onCycleColor: () => void;
  onRandomize: () => void;
  onSaveConfig: () => void; // Add prop for saving config
}

const CustomizationControls: React.FC<CustomizationControlsProps> = ({
  config,
  headOptions,
  torsoOptions,
  armOptions,
  legOptions,
  onCycleOption,
  onCycleColor,
  onRandomize,
  onSaveConfig, // Destructure the new prop
}) => {
  // State is now managed by the parent component (App.tsx)

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "15px", // Add some spacing between control groups
      }}
    >
      <h2>Customize Your Robot</h2>

      {/* Part Selection */}
      <div>
        <h4>Parts</h4>
        {/* Use the passed-in callback functions */}
        <button onClick={() => onCycleOption("head", headOptions)}>
          Head: {config.head}
        </button>
        <button onClick={() => onCycleOption("torso", torsoOptions)}>
          Torso: {config.torso}
        </button>
        <button onClick={() => onCycleOption("arms", armOptions)}>
          Arms: {config.arms}
        </button>
        <button onClick={() => onCycleOption("legs", legOptions)}>
          Legs: {config.legs}
        </button>
      </div>

      {/* Color Selection */}
      <div>
        <h4>Color</h4>
        <button
          onClick={onCycleColor} // Use the passed-in callback
          style={{
            backgroundColor: config.color,
            color: "#fff", // Consider calculating contrast for better readability
            border: "1px solid #555",
            padding: "5px 10px",
          }}
        >
          Color: {config.color}
        </button>
        {/* Display color swatch */}
        <div
          style={{
            width: "30px",
            height: "30px",
            backgroundColor: config.color,
            border: "1px solid #ccc",
            display: "inline-block",
            marginLeft: "10px",
            verticalAlign: "middle",
          }}
        ></div>
      </div>

      {/* Actions Section */}
      <div
        style={{
          marginTop: "20px",
          borderTop: "1px solid #ccc",
          paddingTop: "15px",
          display: "flex",
          gap: "10px" /* Add gap for buttons */,
        }}
      >
        <h4>Actions</h4>
        <button onClick={onRandomize}>Randomize</button>
        <button onClick={onSaveConfig}>Save Configuration</button>{" "}
        {/* Add Save button */}
      </div>
    </div>
  );
};

export default CustomizationControls;
