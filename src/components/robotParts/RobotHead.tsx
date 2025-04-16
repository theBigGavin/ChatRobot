import React from "react";
import { Box, Sphere } from "@react-three/drei";
import * as THREE from "three"; // Import THREE for MeshStandardMaterial

interface RobotHeadProps {
  headType: string; // e.g., "Head A", "Head B"
  color: string;
  position?: [number, number, number];
}

const RobotHead: React.FC<RobotHeadProps> = ({
  headType,
  color,
  position = [0, 0, 0],
}) => {
  const material = new THREE.MeshStandardMaterial({ color });

  return (
    <group position={position}>
      {headType === "Head A" && (
        <Box args={[0.6, 0.6, 0.6]} material={material} castShadow />
      )}
      {headType === "Head B" && (
        <Sphere args={[0.4, 32, 32]} material={material} castShadow />
      )}
      {headType === "Head C" && (
        <Box args={[0.7, 0.5, 0.5]} material={material} castShadow />
      )}
      {/* Default or fallback */}
      {!["Head A", "Head B", "Head C"].includes(headType) && (
        <Box args={[0.5, 0.5, 0.5]} material={material} castShadow />
      )}
    </group>
  );
};

export default RobotHead;
