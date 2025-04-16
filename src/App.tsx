import { useState, useEffect, useRef, lazy, Suspense } from "react"; // Import lazy and Suspense
import { Canvas, useFrame } from "@react-three/fiber"; // Import useFrame
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three"; // Import THREE for Group ref type
// Import types separately
import type { RobotConfig } from "./components/CustomizationControls";
import type { ChatMessage } from "./components/ChatInterface";
// Lazy load components
const CustomizationControls = lazy(
  () => import("./components/CustomizationControls")
);
const ChatInterface = lazy(() => import("./components/ChatInterface"));
const WelcomeScreen = lazy(() => import("./components/WelcomeScreen"));
// Import the robot part components
import RobotHead from "./components/robotParts/RobotHead";
import RobotTorso from "./components/robotParts/RobotTorso";
import RobotArms from "./components/robotParts/RobotArms";
import RobotLegs from "./components/robotParts/RobotLegs";
import "./App.css";

// Define options in the parent component
const HEAD_OPTIONS = ["Head A", "Head B", "Head C"];
const TORSO_OPTIONS = ["Torso A", "Torso B", "Torso C"];
const ARM_OPTIONS = ["Arms A", "Arms B"]; // Currently only one visual for arms
const LEG_OPTIONS = ["Legs A", "Legs B"];
const COLOR_OPTIONS = ["#ff6347", "#4682b4", "#32cd32", "#ffd700", "#8a2be2"];

const LOCAL_STORAGE_KEY = "aiPartnerSimulatorConfig"; // Key for localStorage

// Helper function to strip basic Markdown
const stripMarkdown = (text: string): string => {
  // Remove bold/italic markers (*, _)
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  // Remove headings (#)
  text = text.replace(/^#+\s*/gm, "");
  // Remove links, keeping the text ([text](url) -> text)
  text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1");
  // Remove inline code (`)
  text = text.replace(/`(.*?)`/g, "$1");
  // Remove code blocks (```) - simple removal, might leave extra newlines
  text = text.replace(/```[\s\S]*?```/g, "");
  // Remove horizontal rules (---, ***, ___)
  text = text.replace(/^(---|___|\*\*\*)\s*$/gm, "");
  // Remove blockquotes (> )
  text = text.replace(/^>\s*/gm, "");
  // Remove list markers (*, -, + followed by space)
  text = text.replace(/^(\*|-|\+)\s+/gm, "");
  // Remove extra newlines left from block elements
  text = text.replace(/\n{2,}/g, "\n");
  return text.trim();
};

// Component to handle the robot assembly and animation
const RobotModel = ({
  config,
  isSpeaking,
}: {
  config: RobotConfig;
  isSpeaking: boolean;
}) => {
  // Add isSpeaking prop
  const groupRef = useRef<THREE.Group>(null!); // Ref for the entire robot group
  const headGroupRef = useRef<THREE.Group>(null!); // Ref specifically for the head group

  // --- Calculate approximate positions based on typical part sizes ---
  const torsoHeight = 1.1;
  const headHeight = 0.6;
  const legHeight = 1.0;
  const headY = torsoHeight / 2 + headHeight / 2 - 0.1;
  const armsY = 0;
  const legsY = -(torsoHeight / 2 + legHeight / 2) + 0.1;
  const robotBaseY = legHeight / 2 - legsY; // Initial base position offset
  // --- End Position Calculation ---

  // --- Animation ---
  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();

    // Idle Animation (Floating)
    if (groupRef.current) {
      const amplitude = 0.05;
      const speed = 2;
      groupRef.current.position.y =
        robotBaseY + Math.sin(elapsedTime * speed) * amplitude;
    }

    // Speaking Animation (Head Scale Pulse)
    if (headGroupRef.current) {
      if (isSpeaking) {
        const scaleAmplitude = 0.05; // How much the head scales
        const scaleSpeed = 15; // How fast the head pulses
        const scale = 1 + Math.sin(elapsedTime * scaleSpeed) * scaleAmplitude;
        headGroupRef.current.scale.set(scale, scale, scale);
      } else {
        // Reset scale when not speaking
        headGroupRef.current.scale.set(1, 1, 1);
      }
    }
  });
  // --- End Animation ---

  return (
    <group ref={groupRef} position={[0, robotBaseY, 0]}>
      {/* Wrap Head in its own group for independent animation */}
      <group ref={headGroupRef} position={[0, headY, 0]}>
        <RobotHead
          headType={config.head}
          color={config.color}
          position={[0, 0, 0]}
        />{" "}
        {/* Position relative to head group */}
      </group>
      <RobotTorso
        torsoType={config.torso}
        color={config.color}
        position={[0, 0, 0]}
      />
      <RobotArms
        armType={config.arms}
        color={config.color}
        position={[0, armsY, 0]}
      />
      <RobotLegs
        legType={config.legs}
        color={config.color}
        position={[0, legsY, 0]}
      />
    </group>
  );
};

function App() {
  // --- State for App Flow ---
  const [hasStarted, setHasStarted] = useState(false);
  // --- End App Flow State ---

  // Initialize state with default or loaded config
  const [config, setConfig] = useState<RobotConfig>(() => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    let initialConfig = null; // Temp variable to hold loaded config
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        if (
          parsedConfig.head &&
          parsedConfig.torso &&
          parsedConfig.arms &&
          parsedConfig.legs &&
          parsedConfig.color &&
          HEAD_OPTIONS.includes(parsedConfig.head) &&
          TORSO_OPTIONS.includes(parsedConfig.torso) &&
          ARM_OPTIONS.includes(parsedConfig.arms) &&
          LEG_OPTIONS.includes(parsedConfig.legs) &&
          COLOR_OPTIONS.includes(parsedConfig.color)
        ) {
          initialConfig = parsedConfig; // Store valid loaded config
          return initialConfig;
        }
      } catch (e) {
        console.error("Failed to parse saved config:", e);
      }
    }
    // Default config if nothing valid is saved
    return {
      head: HEAD_OPTIONS[0],
      torso: TORSO_OPTIONS[0],
      arms: ARM_OPTIONS[0],
      legs: LEG_OPTIONS[0],
      color: COLOR_OPTIONS[0],
    };
  });

  // Effect to check for saved config on initial load and set hasStarted
  useEffect(() => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedConfig) {
      setHasStarted(true);
    }
  }, []); // Empty dependency array means run only once on mount

  // Effect to save config to localStorage whenever it changes, ONLY if started
  useEffect(() => {
    if (hasStarted) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    }
  }, [config, hasStarted]);

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // <<< Add speaking state
  const messageIdCounter = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getNextMessageId = () => {
    messageIdCounter.current += 1;
    return `msg-${messageIdCounter.current}`;
  };
  // --- End Chat State ---

  // --- TTS Function ---
  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const plainText = stripMarkdown(text);
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.rate = 1.5;

      // --- Add event listeners ---
      utterance.onstart = () => {
        console.log("Speech started");
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        console.log("Speech ended");
        setIsSpeaking(false);
        setIsBotTyping(false); // <<< Reset typing state here
        utteranceRef.current = null; // Clear ref when done
      };
      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false); // Ensure state is reset on error
        setIsBotTyping(false); // <<< Reset typing state here too
        utteranceRef.current = null;
      };
      // --- End event listeners ---

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Web Speech Synthesis API not supported by this browser.");
      setIsBotTyping(false); // <<< Reset typing state if not supported
    }
  };
  // --- End TTS Function ---

  // Define callback functions here
  const handleCycleOption = (part: keyof RobotConfig, options: string[]) => {
    setConfig((prevConfig) => {
      const currentIndex = options.indexOf(prevConfig[part] as string);
      const nextIndex = (currentIndex + 1) % options.length;
      return { ...prevConfig, [part]: options[nextIndex] };
    });
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } // Reset speaking state
  };

  const handleCycleColor = () => {
    setConfig((prevConfig) => {
      const currentIndex = COLOR_OPTIONS.indexOf(prevConfig.color);
      const nextIndex = (currentIndex + 1) % COLOR_OPTIONS.length;
      return { ...prevConfig, color: COLOR_OPTIONS[nextIndex] };
    });
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } // Reset speaking state
  };

  const handleRandomize = () => {
    const randomHead =
      HEAD_OPTIONS[Math.floor(Math.random() * HEAD_OPTIONS.length)];
    const randomTorso =
      TORSO_OPTIONS[Math.floor(Math.random() * TORSO_OPTIONS.length)];
    const randomArms =
      ARM_OPTIONS[Math.floor(Math.random() * ARM_OPTIONS.length)];
    const randomLegs =
      LEG_OPTIONS[Math.floor(Math.random() * LEG_OPTIONS.length)];
    const randomColor =
      COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)];
    setConfig({
      head: randomHead,
      torso: randomTorso,
      arms: randomArms,
      legs: randomLegs,
      color: randomColor,
    });
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } // Reset speaking state
  };

  // --- Function to manually save config ---
  const handleSaveConfig = () => {
    if (hasStarted) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      alert("Configuration saved!");
    } else {
      alert("Cannot save before starting customization.");
    }
  };
  // --- End Save Config Function ---

  // --- Chat Message Handler (Streaming Version) ---
  const handleSendMessage = async (text: string) => {
    const userMessageId = getNextMessageId();
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: "user",
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } // Reset speaking state
    setIsBotTyping(true);
    const botMessageId = getNextMessageId();
    let fullBotReply = "";
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, sender: "bot", text: "...", timestamp: Date.now() },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: import.meta.env.VITE_LLM_MODEL || "default-model",
          messages: [{ role: "user", content: text }],
          stream: true,
        }),
      });

      if (!response.ok) {
        let errorText = "Failed to start stream.";
        try {
          const errorData = await response.json();
          console.error("API Error Response:", errorData);
          errorText =
            errorData?.error?.message ||
            errorData?.error ||
            errorData?.message ||
            JSON.stringify(errorData);
        } catch {
          // Remove unused 'e' variable
          // Keep eslint happy
          errorText = `API request failed with status ${response.status}`;
          console.error(
            "API Error: Status",
            response.status,
            await response.text()
          );
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: `Error: ${errorText}` }
              : msg
          )
        );
        setIsBotTyping(false); // <<< Already here, good.
        return;
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let partialChunk = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialChunk + chunk).split("\n");
        partialChunk = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataString = line.substring(5).trim();
            if (dataString === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsedData = JSON.parse(dataString);
              const delta = parsedData.choices?.[0]?.delta?.content;
              if (delta) {
                fullBotReply += delta;
                // console.log(`Received delta: "${delta}", Current full reply length: ${fullBotReply.length}`);
                setMessages((prevMessages) => {
                  const targetIndex = prevMessages.findIndex(
                    (msg) => msg.id === botMessageId
                  );
                  if (targetIndex !== -1) {
                    const newMessages = [...prevMessages];
                    newMessages[targetIndex] = {
                      ...prevMessages[targetIndex],
                      text: fullBotReply,
                    };
                    return newMessages;
                  }
                  return prevMessages;
                });
              }
            } catch (parseError) {
              console.error(
                "Failed to parse stream data chunk:",
                dataString,
                parseError
              );
            }
          }
        }
      }
      if (fullBotReply) {
        speak(fullBotReply);
      }
    } catch (error) {
      console.error("Network or Fetch Error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: "Error: Could not reach the chat service." }
            : msg
        )
      );
      setIsBotTyping(false); // <<< Add here for fetch/network errors
    } finally {
      setIsBotTyping(false); // <<< Add here to ensure reset in all cases
    }
  };
  // --- End Chat Message Handler ---

  // --- App Start Handler ---
  const handleStart = () => {
    setHasStarted(true);
  };
  // --- End App Start Handler ---

  // --- Conditional Rendering with Suspense for WelcomeScreen ---
  if (!hasStarted) {
    return (
      <Suspense fallback={<div>Loading Welcome Screen...</div>}>
        <WelcomeScreen onStart={handleStart} />
      </Suspense>
    );
  }
  // --- End Conditional Rendering ---

  return (
    // Main container using Flexbox for layout
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      {/* Left column for 3D Canvas */}
      <div
        style={{
          flex: "0 0 70%",
          height: "100%",
          background: "#282c34",
          position: "relative",
        }}
      >
        <Canvas shadows camera={{ position: [0, 2, 5], fov: 75 }}>
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          {/* Render the RobotModel component, passing isSpeaking state */}
          <RobotModel config={config} isSpeaking={isSpeaking} />
          {/* Ground plane */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            target={[0, 1.5, 0]}
          />
        </Canvas>
      </div>

      {/* Right column for Controls and Chat */}
      <div
        style={{
          flex: "0 0 30%",
          height: "100%",
          borderLeft: "1px solid #ccc",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Wrap Controls and Chat in Suspense */}
        <Suspense fallback={<div>Loading UI...</div>}>
          {/* Customization Controls Area */}
          <div style={{ flex: "0 0 auto", borderBottom: "1px solid #ccc" }}>
            <CustomizationControls
              config={config}
              headOptions={HEAD_OPTIONS}
              torsoOptions={TORSO_OPTIONS}
              armOptions={ARM_OPTIONS}
              legOptions={LEG_OPTIONS}
              colorOptions={COLOR_OPTIONS}
              onCycleOption={handleCycleOption}
              onCycleColor={handleCycleColor}
              onRandomize={handleRandomize}
              onSaveConfig={handleSaveConfig} // Pass the save handler
            />
          </div>
          {/* Chat Interface Area */}
          <div style={{ flex: "1 1 auto", minHeight: 0 }}>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isBotTyping={isBotTyping}
            />
          </div>
        </Suspense>
      </div>
    </div>
  );
}

export default App;
