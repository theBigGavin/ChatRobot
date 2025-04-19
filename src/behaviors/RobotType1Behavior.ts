// src/behaviors/RobotType1Behavior.ts
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IRobotBehavior, AnimationName } from '../types/robot';

// --- Constants specific to RobotType1 ---
const shoulderPositionOffset = new THREE.Vector3(0, 0.4, 0);
const armPivotLocalOffset = new THREE.Vector3(0, -0.4, 0); // Re-introduce offset for direct arm placement

// Define the curve for visual reference (optional)
// 调整曲线点以实现 "举起再落下" 的效果 (数值可能需要微调)
const fingertipStartLocal = new THREE.Vector3(0, 0, 1);    // 起点: 较低，稍靠前
const fingertipEndLocal = new THREE.Vector3(0.2, 3, 0.8);  // 终点: 也较低，位置略有变化
const fingertipControl1Local = new THREE.Vector3(0.6, 5, 0.5); // 控制点1: 很高，稍向右
const fingertipControl2Local = new THREE.Vector3(-0.9, 4, 0.3);// 控制点2: 也很高，稍向左
const fingertipPathCurve = new THREE.CubicBezierCurve3(
  fingertipStartLocal,
  fingertipControl1Local,
  fingertipControl2Local,
  fingertipEndLocal
);

const waveAnimationDuration = 3000; // ms
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
  private curveVisual: THREE.Line | null = null; // Keep for debugging reference
  private waveAnimationStartTime: number | null = null; // Track wave start time

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

      // Create curve visualization using local points relative to shoulder
      const curvePoints = fingertipPathCurve.getPoints(50);
      const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const curveMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 1 }); // Magenta
      this.curveVisual = new THREE.Line(curveGeometry, curveMaterial);
      // Position the visualization at the shoulder offset relative to the robot group
      this.curveVisual.position.copy(shoulderPositionOffset);
      this.robotGroup.add(this.curveVisual); // Add visual to the main robot group

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

  playAnimation(name: AnimationName, duration: number = waveAnimationDuration): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isLoaded || !this.rightArmPivot || !this.initialShoulderRotation) { // Removed elbow checks
        console.warn("Robot/Arm not fully loaded or initial state not set, cannot play animation:", name);
        resolve();
        return;
      }
      if (this.animationTimer) clearTimeout(this.animationTimer);
      this.currentAnimation = name;

      if (name === 'wave') {
        this.waveAnimationStartTime = null; // Reset start time, will be captured in update
        this.animationTimer = setTimeout(() => {
          if (this.currentAnimation === 'wave') {
            this.currentAnimation = 'returning';
            this.waveAnimationStartTime = null; // Clear start time when wave ends
          }
          this.animationTimer = null;
          resolve();
        }, duration);
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
          // --- Direct Rotation Wave with Relative Time ---
          // Capture start time on the first frame
          if (this.waveAnimationStartTime === null) {
            this.waveAnimationStartTime = elapsedTime;
          }
          // Calculate elapsed time relative to the start of this specific wave animation
          const waveElapsedTime = elapsedTime - this.waveAnimationStartTime;

          // Apply sinusoidal rotation on X, Y, Z axes relative to initial rotation
          // this.rightArmPivot.rotation.x = this.initialShoulderRotation.x + Math.sin(t * waveSpeed) * (waveAmplitude * 0.2);
          // this.rightArmPivot.rotation.y = this.initialShoulderRotation.y + Math.sin(t * waveSpeed * 0.5) * (waveAmplitude * 1.0);
          // this.rightArmPivot.rotation.z = this.initialShoulderRotation.z + Math.sin(t * waveSpeed * 0.7) * (waveAmplitude * 0.4);
          const p = (Math.sin(waveElapsedTime * 0.5) + 1) / 2; // Use relative time
          const targetPoint = fingertipPathCurve.getPoint(p);
          this.rightArmPivot.lookAt(targetPoint);

        } else { // returning or idle
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
    if (this.curveVisual) {
      this.curveVisual.geometry?.dispose();
      if (this.curveVisual.material instanceof THREE.Material) {
        this.curveVisual.material.dispose();
      }
      this.robotGroup?.remove(this.curveVisual); // Remove from robotGroup
      this.curveVisual = null;
    }

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