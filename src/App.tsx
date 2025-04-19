import React, { useState, useEffect, useRef } from "react"; // Removed useMemo
import { Canvas } from "@react-three/fiber"; // Import useFrame removed as it's in controller
import { OrbitControls } from "@react-three/drei";
import {
  EffectComposer,
  Scanline,
  Bloom,
  Noise,
  Vignette,
} from "@react-three/postprocessing"; // Import Vignette
import RobotViewer from "./components/RobotViewer";
import GachaControls from "./components/GachaControls";
import StatusMeters from "./components/StatusMeters";
import ChatConsole from "./components/ChatConsole";
import PhysicalControls from "./components/PhysicalControls";
import { useAppStore, selectGameState } from "./store/useAppStore";
import { RobotType1Behavior } from "./behaviors/RobotType1Behavior"; // Import behavior
import { IRobotBehavior } from "./types/robot"; // Removed AnimationName import
const setRobotBehavior = useAppStore.getState().setRobotBehavior; // Import action directly for use outside component body

// CSS for screen shake effect
const screenShakeStyle = `
@keyframes screenShake {
  0% { transform: translate(1px, 1px) rotate(0deg); }
  10% { transform: translate(-1px, -2px) rotate(-0.5deg); }
  20% { transform: translate(-3px, 0px) rotate(0.5deg); }
  30% { transform: translate(3px, 2px) rotate(0deg); }
  40% { transform: translate(1px, -1px) rotate(0.5deg); }
  50% { transform: translate(-1px, 2px) rotate(-0.5deg); }
  60% { transform: translate(-3px, 1px) rotate(0deg); }
  70% { transform: translate(3px, 1px) rotate(-0.5deg); }
  80% { transform: translate(-1px, -1px) rotate(0.5deg); }
  90% { transform: translate(1px, 2px) rotate(0deg); }
  100% { transform: translate(1px, -2px) rotate(-0.5deg); }
}
.screen-shake {
  animation: screenShake 0.3s cubic-bezier(.36,.07,.19,.97) both;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
}
`;

// Define the type for effect parameters
interface EffectParams {
  baseScanlineOpacity: number;
  baseNoiseOpacity: number;
  currentScanlineOpacity: number;
  currentNoiseOpacity: number;
  bloomIntensity: number;
}

// Internal component to handle effects logic using useFrame
// Need to import useFrame here if CRTEffectsController is defined in this file
import { useFrame as useFrameEffects } from "@react-three/fiber"; // Alias if needed

const CRTEffectsController: React.FC<{
  isGenerating: boolean;
  effectsRef: React.MutableRefObject<EffectParams>; // Use defined type
  setEffectParams: React.Dispatch<React.SetStateAction<EffectParams>>; // Use defined type
}> = ({ isGenerating, effectsRef, setEffectParams }) => {
  // useFrame hook for continuous subtle fluctuations when idle
  useFrameEffects(({ clock }) => {
    // Use the imported useFrame
    if (!isGenerating) {
      const time = clock.getElapsedTime();
      // Subtle sine wave fluctuations for scanline and noise opacity
      const scanFluctuation = ((Math.sin(time * 2.5) + 1) / 2) * 0.03; // Small range (0 to 0.03)
      const noiseFluctuation = ((Math.sin(time * 3.1) + 1) / 2) * 0.015; // Smaller range (0 to 0.015)

      // Update state only if values actually change significantly to avoid excessive re-renders
      const newScanOpacity =
        effectsRef.current.baseScanlineOpacity + scanFluctuation;
      const newNoiseOpacity =
        effectsRef.current.baseNoiseOpacity + noiseFluctuation;

      if (
        Math.abs(newScanOpacity - effectsRef.current.currentScanlineOpacity) >
          0.001 ||
        Math.abs(newNoiseOpacity - effectsRef.current.currentNoiseOpacity) >
          0.001
      ) {
        setEffectParams((prev: EffectParams) => ({
          // Explicitly type 'prev'
          ...prev,
          currentScanlineOpacity: newScanOpacity,
          currentNoiseOpacity: newNoiseOpacity,
        }));
      }
    }
  });

  return null; // This component doesn't render anything itself
};

// Component for the left CRT screen area containing the 3D Canvas
const CRTScreen: React.FC<{ robotBehavior: IRobotBehavior | null }> = ({
  robotBehavior,
}) => {
  // Accept behavior
  const gameState = useAppStore(selectGameState);
  const isGenerating = gameState === "robot_generating";

  // State for effect parameters, including base values for idle state
  const [effectParams, setEffectParams] = useState<EffectParams>({
    // Add type here
    baseScanlineOpacity: 0.05,
    baseNoiseOpacity: 0.02, // Base subtle noise
    currentScanlineOpacity: 0.05,
    currentNoiseOpacity: 0.02,
    bloomIntensity: 0.5,
  });

  // Ref for animation frame updates
  const effectsRef = useRef(effectParams);
  useEffect(() => {
    effectsRef.current = effectParams;
  }, [effectParams]);

  // Effect for the generation sequence animation
  useEffect(() => {
    let noiseTimeout: NodeJS.Timeout | null = null;
    let scanlineTimeout: NodeJS.Timeout | null = null;

    if (isGenerating) {
      // Start sequence: Intense noise, faint scanlines/bloom
      setEffectParams((prev) => ({
        ...prev,
        currentNoiseOpacity: 0.8,
        currentScanlineOpacity: 0.02,
        bloomIntensity: 0.2,
      }));

      noiseTimeout = setTimeout(() => {
        setEffectParams((prev) => ({
          ...prev,
          currentNoiseOpacity: 0.1,
          currentScanlineOpacity: 0.1,
          bloomIntensity: 0.8,
        }));
      }, 400);

      scanlineTimeout = setTimeout(() => {
        // Return to base values after generation sequence
        setEffectParams((prev) => ({
          ...prev,
          currentNoiseOpacity: prev.baseNoiseOpacity,
          currentScanlineOpacity: prev.baseScanlineOpacity,
          bloomIntensity: 0.5,
        }));
      }, 1000);
    } else {
      // Ensure base values are set if not generating
      setEffectParams((prev) => ({
        ...prev,
        currentNoiseOpacity: prev.baseNoiseOpacity,
        currentScanlineOpacity: prev.baseScanlineOpacity,
        bloomIntensity: 0.5,
      }));
    }

    return () => {
      if (noiseTimeout) clearTimeout(noiseTimeout);
      if (scanlineTimeout) clearTimeout(scanlineTimeout);
    };
  }, [isGenerating]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#1a1a1a",
        border: "5px solid #4a3a2a",
        borderRadius: "15px 0 0 15px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Canvas shadows camera={{ position: [0, 1.5, 5], fov: 60 }}>
        {/* Increased ambient light intensity */}
        <ambientLight intensity={0.7} />
        {/* Increased directional light intensity and adjusted position slightly */}
        <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
        {/* Optional: Add a point light from the front-top-left */}
        <pointLight position={[-2, 3, 3]} intensity={0.5} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1, 0]}
          receiveShadow
        >
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <React.Suspense fallback={null}>
          {/* Conditionally render RobotViewer only when behavior exists */}
          {robotBehavior && <RobotViewer robotBehavior={robotBehavior} />}
        </React.Suspense>
        <OrbitControls target={[0, 0.5, 0]} />
        {/* Render the controller component inside Canvas */}
        <CRTEffectsController
          isGenerating={isGenerating}
          effectsRef={effectsRef}
          setEffectParams={setEffectParams}
        />
        <EffectComposer>
          <Scanline
            blendFunction={1} // SCREEN
            density={1.5}
            opacity={effectParams.currentScanlineOpacity} // Use fluctuating opacity
          />
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            intensity={effectParams.bloomIntensity}
            mipmapBlur
          />
          <Noise
            opacity={effectParams.currentNoiseOpacity} // Use fluctuating opacity
            blendFunction={1 /* SCREEN */}
          />
          <Vignette
            eskil={false} // Use simpler vignette effect
            offset={0.2} // Adjust darkness offset
            darkness={0.6} // Adjust darkness intensity
          />
          {/* Optional: Add Glitch later with very low strength/frequency */}
          {/* <Glitch delay={[10, 20]} duration={[0.1, 0.2]} strength={[0.01, 0.02]} ratio={0.5} /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

// --- Define DashboardPlaceholder OUTSIDE App component ---
const DashboardPlaceholder: React.FC = React.memo(() => {
  // Wrap with React.memo
  // ... (Dashboard code remains the same) ...
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(145deg, #d4c8b8, #a39887)",
        display: "flex",
        flexDirection: "column",
        color: "#3b2e1e",
        borderRight: "5px solid #4a3a2a",
        borderTop: "5px solid #4a3a2a",
        borderBottom: "5px solid #4a3a2a",
        borderRadius: "0 15px 15px 0",
        padding: "15px",
        boxSizing: "border-box",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          flex: 1,
          marginBottom: "10px",
          minHeight: "100px",
          background: "rgba(0,0,0,0.1)",
          borderRadius: "5px",
          padding: "5px",
        }}
      >
        <GachaControls />
      </div>
      <div
        style={{
          flex: 1,
          marginBottom: "10px",
          minHeight: "100px",
          background: "rgba(0,0,0,0.1)",
          borderRadius: "5px",
          padding: "5px",
        }}
      >
        <StatusMeters />
      </div>
      <div
        style={{
          flex: 2,
          marginBottom: "10px",
          minHeight: "200px",
          background: "rgba(0,0,0,0.1)",
          borderRadius: "5px",
          padding: "5px",
        }}
      >
        <ChatConsole key="chat-console" /> {/* Keep stable key */}
      </div>
      <div
        style={{
          flex: 0.5,
          minHeight: "50px",
          background: "rgba(0,0,0,0.1)",
          borderRadius: "5px",
          padding: "5px",
        }}
      >
        <PhysicalControls />
      </div>
    </div>
  );
}); // End of React.memo wrapper
// --- End DashboardPlaceholder definition ---

function App() {
  const gameState = useAppStore(selectGameState);
  const setGameState = useAppStore((store) => store.setGameState);
  const [isShaking, setIsShaking] = useState(false);
  // State to hold the current robot behavior instance
  const [currentRobotBehavior, setCurrentRobotBehavior] =
    useState<IRobotBehavior | null>(null);
  // State to potentially trigger animations (if needed outside behavior)
  // const [animationToPlay, setAnimationToPlay] = useState<AnimationName | null>(null);

  const handleGenerateRobot = () => {
    console.log("Generating RobotType1Behavior...");
    // Dispose of the old behavior if it exists before creating a new one
    if (currentRobotBehavior) {
      console.log("Disposing old robot behavior...");
      currentRobotBehavior.dispose();
      setRobotBehavior(null); // Clear behavior from store
    }
    const newBehavior = new RobotType1Behavior();
    setCurrentRobotBehavior(newBehavior); // Update local state
    setRobotBehavior(newBehavior); // Set new behavior in store
    console.log("New RobotType1Behavior created and set in store.");
    // setAnimationToPlay(null); // Reset any animation trigger
  };

  const handlePlayWave = () => {
    if (currentRobotBehavior) {
      console.log("Triggering wave animation...");
      currentRobotBehavior.playAnimation("wave").then(() => {
        console.log("Wave animation promise resolved (duration ended).");
      });
    } else {
      console.warn("No robot behavior loaded to play wave animation.");
    }
  };

  const handlePlayJump = () => {
    if (currentRobotBehavior) {
      console.log("Triggering jump animation...");
      currentRobotBehavior.playAnimation("jump").then(() => {
        console.log("Jump animation triggered (promise resolved immediately).");
      });
    } else {
      console.warn("No robot behavior loaded to play jump animation.");
    }
  };

  const handlePlayWalk = () => {
    if (currentRobotBehavior) {
      console.log("Triggering walk animation...");
      currentRobotBehavior.playAnimation("walk").then(() => {
        console.log("Walk animation triggered (promise resolved immediately).");
      });
    } else {
      console.warn("No robot behavior loaded to play walk animation.");
    }
  };

  const handlePlayRun = () => {
    if (currentRobotBehavior) {
      console.log("Triggering run animation...");
      currentRobotBehavior.playAnimation("run").then(() => {
        console.log("Run animation triggered (promise resolved immediately).");
      });
    } else {
      console.warn("No robot behavior loaded to play run animation.");
    }
  };

  useEffect(() => {
    if (gameState === "robot_generating") {
      setIsShaking(true);
      const shakeTimer = setTimeout(() => setIsShaking(false), 300);
      const stateResetTimer = setTimeout(() => {
        console.log("Generation sequence finished, returning to idle.");
        setGameState("idle");
      }, 1100);

      return () => {
        clearTimeout(shakeTimer);
        clearTimeout(stateResetTimer);
      };
    }
  }, [gameState, setGameState]);

  return (
    <>
      <style>{screenShakeStyle}</style>
      {/* Add Buttons outside the main flex container */}
      <div
        style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}
      >
        <button onClick={handleGenerateRobot}>确认生成 / 重置机器人</button>
        <button
          onClick={handlePlayWave}
          disabled={!currentRobotBehavior}
          style={{ marginLeft: "10px" }}
        >
          播放挥手动画
        </button>
        {/* 添加跳跃按钮 */}
        <button
          onClick={handlePlayJump}
          disabled={!currentRobotBehavior}
          style={{ marginLeft: "10px" }}
        >
          播放跳跃动画
        </button>
        {/* 添加行走按钮 */}
        <button
          onClick={handlePlayWalk}
          disabled={!currentRobotBehavior}
          style={{ marginLeft: "10px" }}
        >
          播放行走动画
        </button>
        {/* 添加奔跑按钮 */}
        <button
          onClick={handlePlayRun}
          disabled={!currentRobotBehavior}
          style={{ marginLeft: "10px" }}
        >
          播放奔跑动画
        </button>
      </div>
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "#333",
          padding: "20px", // Restore padding for inner spacing
          boxSizing: "border-box",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className={isShaking ? "screen-shake" : ""}
          style={{
            display: "flex",
            width: "90%",
            maxWidth: "1400px",
            height: "85%",
            boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
            transition: "transform 0.1s ease-out",
          }}
        >
          <div style={{ flex: "0 0 65%", height: "100%" }}>
            {" "}
            {/* Increased CRT width */}
            {/* Pass behavior to CRTScreen */}
            <CRTScreen robotBehavior={currentRobotBehavior} />
          </div>
          <div style={{ flex: "0 0 35%", height: "100%" }}>
            {" "}
            {/* Decreased Dashboard width */}
            <DashboardPlaceholder key="dashboard-placeholder" />{" "}
            {/* Add stable key */}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
