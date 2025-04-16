import React from "react";
import { Box, Cylinder } from "@react-three/drei";
import * as THREE from "three";

interface RobotTorsoProps {
  torsoType: string; // e.g., "Torso A", "Torso B"
  color: string;
  position?: [number, number, number];
}

const RobotTorso: React.FC<RobotTorsoProps> = ({
  torsoType,
  color,
  position = [0, 0, 0],
}) => {
  const material = new THREE.MeshStandardMaterial({ color });

  return (
    <group position={position}>
      {torsoType === "Torso A" && (
        <Box args={[0.8, 1, 0.5]} material={material} castShadow />
      )}
      {torsoType === "Torso B" && (
        <Cylinder args={[0.4, 0.4, 1, 32]} material={material} castShadow />
      )}
      {torsoType === "Torso C" && (
        <Box args={[0.6, 1.2, 0.6]} material={material} castShadow />
      )}
      {/* Default or fallback */}
      {!["Torso A", "Torso B", "Torso C"].includes(torsoType) && (
        <Box args={[0.7, 1, 0.5]} material={material} castShadow />
      )}
    </group>
  );
};

export default RobotTorso;
