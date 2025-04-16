import React from "react";
import { Box, Cylinder } from "@react-three/drei";
import * as THREE from "three";

interface RobotLegsProps {
  legType: string; // e.g., "Legs A", "Legs B"
  color: string;
  position?: [number, number, number]; // Position of the center point between legs
}

const RobotLegs: React.FC<RobotLegsProps> = ({
  legType,
  color,
  position = [0, 0, 0],
}) => {
  const material = new THREE.MeshStandardMaterial({ color });
  const legWidth = 0.25;
  const legHeight = 1.0;
  const legDepth = 0.25;
  const legSpacing = 0.2; // Half the distance between leg centers

  return (
    <group position={position}>
      {legType === "Legs A" && (
        <>
          {/* Left Leg */}
          <Box
            args={[legWidth, legHeight, legDepth]}
            material={material}
            position={[-legSpacing, 0, 0]}
            castShadow
          />
          {/* Right Leg */}
          <Box
            args={[legWidth, legHeight, legDepth]}
            material={material}
            position={[legSpacing, 0, 0]}
            castShadow
          />
        </>
      )}
      {legType === "Legs B" && (
        <>
          {/* Left Leg */}
          <Cylinder
            args={[legWidth * 0.6, legWidth * 0.6, legHeight, 16]}
            material={material}
            position={[-legSpacing, 0, 0]}
            castShadow
          />
          {/* Right Leg */}
          <Cylinder
            args={[legWidth * 0.6, legWidth * 0.6, legHeight, 16]}
            material={material}
            position={[legSpacing, 0, 0]}
            castShadow
          />
        </>
      )}
      {/* Default or fallback */}
      {!["Legs A", "Legs B"].includes(legType) && (
        <>
          <Box
            args={[legWidth, legHeight, legDepth]}
            material={material}
            position={[-legSpacing, 0, 0]}
            castShadow
          />
          <Box
            args={[legWidth, legHeight, legDepth]}
            material={material}
            position={[legSpacing, 0, 0]}
            castShadow
          />
        </>
      )}
    </group>
  );
};

export default RobotLegs;
