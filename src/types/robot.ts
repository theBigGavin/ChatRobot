// src/types/robot.ts
import * as THREE from 'three';

export type AnimationName = 'idle' | 'wave' | 'breathe' | 'entering'; // Added entering state

export interface IRobotBehavior {
  /**
   * Loads the robot's assets and adds the main object to the provided group.
   * Should handle preloading if necessary.
   * @param parentGroup The group to add the robot object to.
   */
  load(parentGroup: THREE.Group): Promise<void>;

  /**
   * Returns the main robot object group. Returns null if not loaded.
   */
  getObject(): THREE.Object3D | null;

  /**
   * Plays a specific named animation.
   * @param name The name of the animation to play.
   * @param duration Optional duration for timed animations (like wave).
   * @returns A promise that resolves when the animation completes (especially useful for timed animations).
   */
  playAnimation(name: AnimationName, duration?: number): Promise<void>;

  /**
   * Sets the robot to its default resting or idle pose.
   */
  setToRestPose(): void;

  /**
   * Called every frame to update internal animation state.
   * @param deltaTime Time since the last frame.
   * @param elapsedTime Total elapsed time.
   */
  update(deltaTime: number, elapsedTime: number): void;

  /**
   * Cleans up resources when the robot is removed.
   */
  dispose(): void;
}