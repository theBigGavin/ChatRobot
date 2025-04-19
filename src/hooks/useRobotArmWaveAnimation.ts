import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// --- Constants defined within the hook or passed as arguments ---
// Define the curve for the FINGERTIP path in WORLD coordinates
const fixedX = 0;
const fixedZ = 0;
const fingertipStart = new THREE.Vector3(fixedX - 0.1, 0.2, fixedZ); // Adjusted Y start
const fingertipEnd = new THREE.Vector3(fixedX - 0.1, 0.7, fixedZ - 0.01); // Adjusted Y end
const fingertipControl1 = new THREE.Vector3(fixedX - 0.2, 0.8, fixedZ + 0.15); // Adjusted Y control
const fingertipControl2 = new THREE.Vector3(fixedX + 0.2, 0.1, fixedZ - 0.15); // Adjusted Y control
const fingertipPathCurve = new THREE.CubicBezierCurve3(
  fingertipStart,
  fingertipControl1,
  fingertipControl2,
  fingertipEnd
);

// Removed defaultArmRotation constant
const animationDuration = 3000; // ms
const returnLerpFactor = 0.1; // Speed of returning to rest
const curveSpeed = 1.5; // Speed of moving along the target curve
// ---

export const useRobotArmWaveAnimation = (
  armPivotRef: React.RefObject<THREE.Group | null>,
  playAnimation: boolean,
  initialRotation: THREE.Euler | null // Receive initial rotation as prop
) => {
  const [isAnimating, setIsAnimating] = useState(false);
  // Removed initialRotation state from hook
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Animation Trigger
  useEffect(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    if (playAnimation) {
      // No need to capture initial rotation here anymore
      setIsAnimating(true);
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        animationTimeoutRef.current = null;
      }, animationDuration);
    } else {
      setIsAnimating(false);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [playAnimation]); // Removed dependencies related to internal initialRotation capture

  // Handle Animation Logic
  useFrame((state) => {
    if (!armPivotRef.current) return;

    // Removed internal initial rotation capture logic

    const t = state.clock.getElapsedTime(); // Use clock directly if needed for curve calculation

    if (isAnimating) {
      // Waving Animation
      const p = (Math.sin(t * curveSpeed) + 1) / 2;
      const targetPoint = fingertipPathCurve.getPoint(p);
      armPivotRef.current.lookAt(targetPoint);
    } else {
      // Return to Initial Rest Animation using the passed initialRotation prop
      if (initialRotation && !armPivotRef.current.rotation.equals(initialRotation)) {
        armPivotRef.current.rotation.x = THREE.MathUtils.lerp(
          armPivotRef.current.rotation.x,
          initialRotation.x,
          returnLerpFactor
        );
        armPivotRef.current.rotation.y = THREE.MathUtils.lerp(
          armPivotRef.current.rotation.y,
          initialRotation.y,
          returnLerpFactor
        );
        armPivotRef.current.rotation.z = THREE.MathUtils.lerp(
          armPivotRef.current.rotation.z,
          initialRotation.z,
          returnLerpFactor
        );
        // Optional: Snap to initial rotation if very close
        const epsilon = 0.01;
        if (
          Math.abs(armPivotRef.current.rotation.x - initialRotation.x) < epsilon &&
          Math.abs(armPivotRef.current.rotation.y - initialRotation.y) < epsilon &&
          Math.abs(armPivotRef.current.rotation.z - initialRotation.z) < epsilon
        ) {
          armPivotRef.current.rotation.copy(initialRotation);
        }
      }
    }
  });

  // The hook itself doesn't need to return anything if it just manipulates the ref
};