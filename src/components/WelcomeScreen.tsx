import React from "react";

interface WelcomeScreenProps {
  onStart: () => void; // Callback function when the start button is clicked
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh", // Full viewport height
        width: "100vw", // Full viewport width
        background: "#f0f2f5", // A light background color
        textAlign: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <h1>欢迎来到 AI 伙伴模拟器!</h1>
      <p
        style={{
          maxWidth: "600px",
          margin: "20px 0",
          fontSize: "1.1em",
          color: "#555",
        }}
      >
        在这里，你可以创建属于你自己的独特 3D AI
        伙伴，并与它进行有趣的对话。准备好开始你的创造之旅了吗？
      </p>
      <button
        onClick={onStart}
        style={{
          padding: "12px 25px",
          fontSize: "1.2em",
          cursor: "pointer",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          marginTop: "20px",
        }}
      >
        开始创建
      </button>
    </div>
  );
};

export default WelcomeScreen;
