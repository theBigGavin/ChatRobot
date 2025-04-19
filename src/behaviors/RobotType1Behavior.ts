// src/behaviors/RobotType1Behavior.ts
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IRobotBehavior, AnimationName } from '../types/robot';
import { ArmWaveAnimator } from '../animations/ArmWaveAnimator'; // Import the new animator

// --- Constants specific to RobotType1 ---
const shoulderPositionOffset = new THREE.Vector3(0, 0.4, 0);
const armPivotLocalOffset = new THREE.Vector3(0, -0.4, 0); // Re-introduce offset for direct arm placement

// Curve definition and duration are now moved to ArmWaveAnimator.ts

const returnLerpFactor = 0.1;
// const curveSpeed = 1.5; // No longer used for direct control
// const waveSpeed = 4; // Speed for direct rotation wave
// const waveAmplitude = Math.PI / 5; // Base amplitude for direct rotation wave
const breathSpeed = 2;
const breathAmplitude = 0.01;
const entryStartY = 5.0;
const groundY = 0;
const fallSpeed = 5.0;
const squashDuration = 0.1;
const stretchDuration = 0.2;
const squashScaleY = 0.8;
const squashScaleXZ = 1.1;
// Removed upperArmLength, forearmLength
// ---

// Helper function
const applyShadows = (scene: THREE.Group | undefined) => {
  scene?.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};


export class RobotType1Behavior implements IRobotBehavior {
  private gltfLoader = new GLTFLoader();
  private robotGroup: THREE.Group | null = null;
  private headGroup: THREE.Group | null = null;
  private torsoGroup: THREE.Group | null = null;
  private leftArmGroup: THREE.Group | null = null;
  private rightArmGroup: THREE.Group | null = null; // Arm model group
  private rightArmPivot: THREE.Group | null = null; // Shoulder pivot
  // Removed elbowPivot
  private leftLegGroup: THREE.Group | null = null;
  private rightLegGroup: THREE.Group | null = null;

  private initialShoulderRotation: THREE.Euler | null = null; // Renamed for clarity
  // Removed initialElbowRotation
  private currentAnimation: AnimationName | 'returning' | 'entering_falling' | 'entering_squash' | 'entering_stretch' = 'idle';
  private animationTimer: NodeJS.Timeout | null = null;
  private entryAnimTimer = 0;
  private isLoaded = false;
  // Removed curveVisual variable, now managed by ArmWaveAnimator
  // Removed waveAnimationStartTime, handled by ArmWaveAnimator

  // --- Animators ---
  private armWaveAnimator = new ArmWaveAnimator();
  // ---

  // Removed temp vectors used for IK

  private async loadModel(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
  }

  async load(parentGroup: THREE.Group): Promise<void> {
    if (this.isLoaded) return;

    try {
      const [
        headGltf, torsoGltf, leftArmGltf, rightArmGltf, leftLegGltf, rightLegGltf,
      ] = await Promise.all([
        this.loadModel("/assets/models/robot1/head0.gltf"),
        this.loadModel("/assets/models/robot1/torso.gltf"),
        this.loadModel("/assets/models/robot1/left_arm.gltf"),
        this.loadModel("/assets/models/robot1/right_arm.gltf"), // This is the whole arm again
        this.loadModel("/assets/models/robot1/left_leg.gltf"),
        this.loadModel("/assets/models/robot1/right_leg.gltf"),
      ]);

      this.robotGroup = new THREE.Group();
      this.headGroup = headGltf.scene;
      this.torsoGroup = torsoGltf.scene;
      this.leftArmGroup = leftArmGltf.scene;
      this.rightArmGroup = rightArmGltf.scene; // Whole arm model
      this.leftLegGroup = leftLegGltf.scene;
      this.rightLegGroup = rightLegGltf.scene;

      applyShadows(this.headGroup);
      applyShadows(this.torsoGroup);
      applyShadows(this.leftArmGroup);
      applyShadows(this.rightArmGroup);
      applyShadows(this.leftLegGroup);
      applyShadows(this.rightLegGroup);

      const headPos = new THREE.Vector3(0, 0, 0);
      const torsoPos = new THREE.Vector3(0, 0, 0);
      const leftArmPos = new THREE.Vector3(0, 0, 0);
      const leftLegPos = new THREE.Vector3(0, 0, 0);
      const rightLegPos = new THREE.Vector3(0, 0, 0);

      this.headGroup.position.copy(headPos);
      this.torsoGroup.position.copy(torsoPos);
      this.leftArmGroup.position.copy(leftArmPos);
      this.leftLegGroup.position.copy(leftLegPos);
      this.rightLegGroup.position.copy(rightLegPos);

      // Create and position the shoulder pivot
      this.rightArmPivot = new THREE.Group();
      this.rightArmPivot.name = "ShoulderPivot";
      this.rightArmPivot.position.copy(shoulderPositionOffset);

      // Position the arm model directly relative to the shoulder pivot, using offset
      this.rightArmGroup.position.copy(armPivotLocalOffset);
      this.rightArmPivot.add(this.rightArmGroup); // Add arm directly to shoulder pivot

      // Get the curve visual object from the animator and add it to the scene
      const curveVisualObject = this.armWaveAnimator.getCurveVisualObject();
      if (curveVisualObject && this.robotGroup) {
        // Position the visualization at the shoulder offset relative to the robot group
        curveVisualObject.position.copy(shoulderPositionOffset);
        this.robotGroup.add(curveVisualObject);
        // Optionally set default visibility (default is false in animator)
        // this.armWaveAnimator.setShowCurveVisual(true);
      }

      // Add all parts to the main robot group
      this.robotGroup.add(this.headGroup);
      this.robotGroup.add(this.torsoGroup);
      this.robotGroup.add(this.leftArmGroup);
      this.robotGroup.add(this.rightArmPivot);
      this.robotGroup.add(this.leftLegGroup);
      this.robotGroup.add(this.rightLegGroup);

      // Capture initial rotation
      this.initialShoulderRotation = this.rightArmPivot.rotation.clone();
      // Removed elbow rotation capture

      // Start entry animation
      this.robotGroup.position.y = entryStartY;
      this.currentAnimation = 'entering_falling';

      parentGroup.add(this.robotGroup);
      this.isLoaded = true;

    } catch (error) {
      console.error("Failed to load robot assets:", error);
    }
  }

  getObject(): THREE.Object3D | null {
    return this.robotGroup;
  }

  // Removed duration parameter as it's now handled internally by ArmWaveAnimator
  playAnimation(name: AnimationName): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isLoaded || !this.rightArmPivot || !this.initialShoulderRotation) { // Removed elbow checks
        console.warn("Robot/Arm not fully loaded or initial state not set, cannot play animation:", name);
        resolve();
        return;
      }
      if (this.animationTimer) clearTimeout(this.animationTimer);
      this.currentAnimation = name;

      if (name === 'wave') {
        // Activate the animator, optionally pass a duration if needed:
        // this.armWaveAnimator.activate(duration); // Example if duration param was kept
        // this.armWaveAnimator.setShowCurveVisual(true)
        this.armWaveAnimator.activate(); // Using default duration defined in animator
        // No need for setTimeout here anymore, animator handles its own lifecycle
        resolve(); // Resolve immediately, animation runs in background via update loop
      } else if (name === 'idle') {
        this.currentAnimation = 'returning';
        resolve();
      } else if (name === 'breathe' || name === 'entering') {
        resolve(); // These are handled internally or always active
      } else {
        console.warn("Unknown animation name:", name);
        resolve();
      }
    });
  }

  /**
   * Controls the visibility of the arm wave animation curve visual.
   * @param show True to show the curve, false to hide it.
   */
  public setShowWaveCurve(show: boolean): void {
    this.armWaveAnimator.setShowCurveVisual(show);
  }

  setToRestPose(): void {
    if (this.rightArmPivot && this.initialShoulderRotation && this.robotGroup) { // Removed elbow checks
      this.rightArmPivot.rotation.copy(this.initialShoulderRotation);
      // Removed elbow reset
      this.robotGroup.position.y = groundY;
      this.robotGroup.scale.set(1, 1, 1);
      this.currentAnimation = 'idle';
    }
    if (this.animationTimer) clearTimeout(this.animationTimer);
  }


  update(deltaTime: number, elapsedTime: number): void {
    if (!this.isLoaded || !this.robotGroup) return;

    // --- Entry Animation ---
    if (this.currentAnimation === 'entering_falling') {
      this.robotGroup.position.y -= fallSpeed * deltaTime;
      if (this.robotGroup.position.y <= groundY) {
        this.robotGroup.position.y = groundY;
        this.currentAnimation = 'entering_squash';
        this.entryAnimTimer = 0;
        if (this.rightArmPivot && this.initialShoulderRotation) { // Removed elbow checks
          this.rightArmPivot.rotation.copy(this.initialShoulderRotation);
          // Removed elbow reset
        }
      }
    } else if (this.currentAnimation === 'entering_squash') {
      this.entryAnimTimer += deltaTime;
      const progress = Math.min(this.entryAnimTimer / squashDuration, 1);
      this.robotGroup.scale.y = THREE.MathUtils.lerp(1, squashScaleY, progress);
      this.robotGroup.scale.x = THREE.MathUtils.lerp(1, squashScaleXZ, progress);
      this.robotGroup.scale.z = THREE.MathUtils.lerp(1, squashScaleXZ, progress);
      this.robotGroup.position.y = groundY + (this.robotGroup.scale.y - 1) * -0.5;
      if (progress >= 1) {
        this.currentAnimation = 'entering_stretch';
        this.entryAnimTimer = 0;
      }
    } else if (this.currentAnimation === 'entering_stretch') {
      this.entryAnimTimer += deltaTime;
      const progress = Math.min(this.entryAnimTimer / stretchDuration, 1);
      this.robotGroup.scale.y = THREE.MathUtils.lerp(squashScaleY, 1, progress);
      this.robotGroup.scale.x = THREE.MathUtils.lerp(squashScaleXZ, 1, progress);
      this.robotGroup.scale.z = THREE.MathUtils.lerp(squashScaleXZ, 1, progress);
      this.robotGroup.position.y = groundY + (this.robotGroup.scale.y - 1) * -0.5;
      if (progress >= 1) {
        this.currentAnimation = 'idle';
        this.robotGroup.scale.set(1, 1, 1);
        const idleScaleY = 1 + Math.sin(elapsedTime * breathSpeed) * breathAmplitude;
        this.robotGroup.position.y = (idleScaleY - 1) * -0.5;
      }
    } else {
      // --- Breathing Animation (Only when idle/returning/wave) ---
      const scaleFactor = 1 + Math.sin(elapsedTime * breathSpeed) * breathAmplitude;
      this.robotGroup.scale.y = scaleFactor;
      this.robotGroup.position.y = (scaleFactor - 1) * -0.5;

      // --- Arm Animation ---
      if (this.rightArmPivot && this.initialShoulderRotation && !this.currentAnimation.startsWith('entering')) { // Removed elbow check
        if (this.currentAnimation === 'wave') {
          // Delegate wave animation update to the animator
          this.armWaveAnimator.update(elapsedTime, this.rightArmPivot);

          // Check if the animator deactivated itself (duration ended)
          if (!this.armWaveAnimator.isActive && this.currentAnimation === 'wave') { // Add check for currentAnimation
            this.currentAnimation = 'returning'; // Switch back to returning state
            console.log("Wave animation finished, switching to returning state.");
          }

        } else { // returning or idle
          // Ensure animator is deactivated when not waving (e.g., if switched directly to idle)
          this.armWaveAnimator.deactivate();
          // Return to Rest or stay Idle
          if (!this.rightArmPivot.rotation.equals(this.initialShoulderRotation)) {
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, this.initialShoulderRotation.x, returnLerpFactor);
            this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, this.initialShoulderRotation.y, returnLerpFactor);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, this.initialShoulderRotation.z, returnLerpFactor);

            this.currentAnimation = 'returning';
            const epsilon = 0.01;
            if (
              Math.abs(this.rightArmPivot.rotation.x - this.initialShoulderRotation.x) < epsilon &&
              Math.abs(this.rightArmPivot.rotation.y - this.initialShoulderRotation.y) < epsilon &&
              Math.abs(this.rightArmPivot.rotation.z - this.initialShoulderRotation.z) < epsilon
              // Removed elbow check
            ) {
              this.rightArmPivot.rotation.copy(this.initialShoulderRotation);
              // Removed elbow copy
              this.currentAnimation = 'idle';
            }
          } else {
            this.currentAnimation = 'idle';
          }
        }
      }
    }
  }


  dispose(): void {
    // Call the animator's dispose method to clean up its resources (like the curve visual)
    this.armWaveAnimator.dispose();

    // The robotGroup traversal below will handle removing the curve visual from the scene graph if it was added
    // No need to manually remove it here anymore.

    this.robotGroup?.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((mat: THREE.Material) => mat.dispose());
        } else if (material) {
          material.dispose();
        }
      }
    });
    this.robotGroup?.parent?.remove(this.robotGroup);
    if (this.animationTimer) clearTimeout(this.animationTimer);
    this.isLoaded = false;
    console.log("RobotType1Behavior disposed");
  }

  // Removed _solveIK method
}