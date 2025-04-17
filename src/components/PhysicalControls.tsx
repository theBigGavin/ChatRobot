import React from "react";

const PhysicalControls: React.FC = () => {
  return (
    <div
      style={{
        border: "1px dashed orange",
        padding: "10px",
        margin: "5px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "center",
          color: "#555",
          fontSize: "small",
        }}
      >
        Physical Controls Area
      </p>
      {/* Placeholder for switches, knobs, buttons */}
    </div>
  );
};

export default PhysicalControls;
