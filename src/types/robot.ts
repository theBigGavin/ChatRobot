// src/types/robot.ts
import * as THREE from 'three';

export type AnimationName = 'idle' | 'wave' | 'breathe' | 'entering' | 'jump'; // 添加 jump 动画名称

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
  // 注意：如果所有动画都像 wave 和 jump 一样由内部动画器管理生命周期，
  // 那么 playAnimation 的 duration 参数可能就不再需要了。
  // 暂时保留 duration? 以兼容旧接口，但新动画应避免依赖它。
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