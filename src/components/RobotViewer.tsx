import React, { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Removed unused imports: useAnimations, useFrame, useAppStore, selectors, initialPartsLibrary, EmoteAction

type RobotViewerProps = Record<string, never>;

// Removed unused types and constants: MixerFinishedEvent, getModelPath, emoteToActionNameMap

const RobotViewer: React.FC<RobotViewerProps> = () => {
  const groupRef = useRef<THREE.Group>(null);

  // --- Load the single robot2 model ---
  const { scene: robotScene } = useGLTF("/assets/models/robot2.gltf"); // Load robot2 directly

  // --- Apply shadows ---
  useEffect(() => {
    robotScene?.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [robotScene]);

  // Render only if the model is loaded
  if (!robotScene) {
    return null;
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]} dispose={null}>
      {" "}
      {/* Adjust position as needed */}
      <primitive object={robotScene} />
    </group>
  );
};

// Preload the single model
useGLTF.preload("/assets/models/robot2.gltf");
// Removed preloading logic for individual parts

export default RobotViewer;
