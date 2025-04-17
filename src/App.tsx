import React, { useState, useEffect, useRef } from "react"; // Import useRef
import { Canvas, useFrame } from "@react-three/fiber"; // Import useFrame
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

// CSS for screen shake effect
const screenShakeStyle = `
@keyframes screenShake {
  0% { transform: translate(1px, 1px) rotate(0deg); }
  10% { transform: translate(-1px, -2px) rotate(-0.5deg); }
  /* ... rest of keyframes ... */
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
const CRTEffectsController: React.FC<{
  isGenerating: boolean;
  effectsRef: React.MutableRefObject<EffectParams>; // Use defined type
  setEffectParams: React.Dispatch<React.SetStateAction<EffectParams>>; // Use defined type
}> = ({ isGenerating, effectsRef, setEffectParams }) => {
  // useFrame hook for continuous subtle fluctuations when idle
  useFrame(({ clock }) => {
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
const CRTScreen: React.FC = () => {
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

  // Removed useFrame from here

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
          <RobotViewer />
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
          <div style={{ flex: "0 0 40%", height: "100%" }}>
            <CRTScreen />
          </div>
          <div style={{ flex: "0 0 60%", height: "100%" }}>
            <DashboardPlaceholder key="dashboard-placeholder" />{" "}
            {/* Add stable key */}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
