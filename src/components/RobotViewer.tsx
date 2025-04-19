import React, { useRef, useEffect } from "react"; // Remove useState again
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { IRobotBehavior } from "../types/robot"; // Import the interface
// Removed animation hook import

type RobotViewerProps = {
  robotBehavior: IRobotBehavior; // Expect a behavior instance
};

// Removed applyShadows function

const RobotViewer: React.FC<RobotViewerProps> = ({ robotBehavior }) => {
  const groupRef = useRef<THREE.Group>(null); // This group will contain the robot
  // Removed initialArmRotation state

  // --- Load Robot via Behavior ---
  useEffect(() => {
    const behavior = robotBehavior; // Use const
    const parentGroup = groupRef.current; // Use const

    if (parentGroup && behavior) {
      console.log("RobotViewer: Loading robot behavior...");
      // Ensure previous content is cleared if behavior changes
      while (parentGroup.children.length > 0) {
        parentGroup.remove(parentGroup.children[0]);
      }
      behavior
        .load(parentGroup)
        .then(() => {
          console.log("RobotViewer: Robot behavior loaded.");
          // Set initial pose after loading
          behavior.setToRestPose();
        })
        .catch((error) => {
          console.error("RobotViewer: Error loading robot behavior:", error);
        });
    }

    // Cleanup on component unmount or if behavior changes
    return () => {
      console.log("RobotViewer: Disposing robot behavior...");
      behavior?.dispose();
    };
  }, [robotBehavior]); // Re-run if the behavior instance changes

  // --- Update Robot Behavior ---
  useFrame((state) => {
    // Delegate all per-frame updates to the behavior instance
    robotBehavior?.update(state.clock.getDelta(), state.clock.getElapsedTime());
    // Removed initial rotation capture logic
  });

  // The RobotViewer now only renders a single group.
  // The robotBehavior is responsible for adding its content to this group via the load method.
  return (
    <group ref={groupRef} dispose={null}>
      {/* Robot content will be added here by robotBehavior.load() */}
    </group>
  );
};

export default RobotViewer;
