import React from "react";
import { Box } from "@react-three/drei";
import * as THREE from "three";

interface RobotArmsProps {
  armType: string; // e.g., "Arms A", "Arms B"
  color: string;
  position?: [number, number, number]; // Position of the center point between arms
}

const RobotArms: React.FC<RobotArmsProps> = ({
  color,
  position = [0, 0, 0],
}) => {
  const material = new THREE.MeshStandardMaterial({ color });
  const armWidth = 0.2;
  const armHeight = 0.8;
  const armDepth = 0.2;
  const armSpacing = 0.5; // Half the distance between arm centers

  return (
    <group position={position}>
      {/* Left Arm */}
      <Box
        args={[armWidth, armHeight, armDepth]}
        material={material}
        position={[-armSpacing, 0, 0]}
        castShadow
      />
      {/* Right Arm */}
      <Box
        args={[armWidth, armHeight, armDepth]}
        material={material}
        position={[armSpacing, 0, 0]}
        castShadow
      />

      {/* Placeholder for different arm types if needed later */}
      {/* {armType === 'Arms B' && ... } */}
    </group>
  );
};

export default RobotArms;
