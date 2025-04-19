// src/behaviors/RobotType1Behavior.ts
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IRobotBehavior, AnimationName } from '../types/robot';
import { ArmWaveAnimator } from '../animations/ArmWaveAnimator'; // 导入挥手动画器
import { JumpAnimator } from '../animations/JumpAnimator'; // 导入跳跃动画器

// --- RobotType1 行为相关的常量 ---
const shoulderPositionOffset = new THREE.Vector3(0, 0.4, 0); // 肩部枢轴相对于机器人中心的偏移
const armPivotLocalOffset = new THREE.Vector3(0, -0.4, 0); // 手臂模型相对于肩部枢轴的局部偏移

// 注意: 挥手动画的曲线、持续时间等现在由 ArmWaveAnimator 管理

const returnLerpFactor = 0.1; // 手臂返回初始姿态的插值系数 (用于 slerp)
const breathSpeed = 2; // 呼吸动画速度
const breathAmplitude = 0.01; // 呼吸动画幅度
const entryStartY = 5.0; // 入场动画起始高度
const groundY = 0; // 地面 Y 坐标
const fallSpeed = 5.0; // 入场下落速度
const squashDuration = 0.1; // 入场挤压动画持续时间 (秒)
const stretchDuration = 0.2; // 入场伸展动画持续时间 (秒)
const squashScaleY = 0.8; // 挤压时 Y 轴缩放
const squashScaleXZ = 1.1; // 挤压时 X/Z 轴缩放
// ---

// 辅助函数：为模型及其子对象递归地启用阴影投射和接收
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
  private robotGroup: THREE.Group | null = null; // 机器人整体 Group
  private headGroup: THREE.Group | null = null; // 头部模型组
  private torsoGroup: THREE.Group | null = null; // 躯干模型组
  private leftArmGroup: THREE.Group | null = null; // 左臂模型组
  private rightArmGroup: THREE.Group | null = null; // 右臂模型组
  private rightArmPivot: THREE.Group | null = null; // 右肩枢轴点 (用于旋转手臂)
  private leftLegGroup: THREE.Group | null = null; // 左腿模型组
  private rightLegGroup: THREE.Group | null = null; // 右腿模型组

  private initialShoulderRotation: THREE.Euler | null = null; // 肩部初始旋转 (Euler角度), 用于返回静止状态
  private currentAnimation: AnimationName | 'returning' | 'entering_falling' | 'entering_squash' | 'entering_stretch' = 'idle'; // 当前动画状态
  private entryAnimTimer = 0; // 入场动画内部计时器
  private isLoaded = false; // 模型是否加载完成标志

  // --- 动画器实例 ---
  private armWaveAnimator = new ArmWaveAnimator(); // 挥手动画器实例
  private jumpAnimator = new JumpAnimator();     // 跳跃动画器实例
  // ---

  // 加载单个 GLTF 模型文件
  private async loadModel(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
  }

  /** 初始化并加载机器人模型和资源 */
  async load(parentGroup: THREE.Group): Promise<void> {
    if (this.isLoaded) return;

    try {
      // 并行加载所有模型部件
      const [
        headGltf, torsoGltf, leftArmGltf, rightArmGltf, leftLegGltf, rightLegGltf,
      ] = await Promise.all([
        this.loadModel("/assets/models/robot1/head0.gltf"),
        this.loadModel("/assets/models/robot1/torso.gltf"),
        this.loadModel("/assets/models/robot1/left_arm.gltf"),
        this.loadModel("/assets/models/robot1/right_arm.gltf"), // 右臂
        this.loadModel("/assets/models/robot1/left_leg.gltf"),  // 左腿
        this.loadModel("/assets/models/robot1/right_leg.gltf"), // 右腿
      ]);

      // 创建机器人根 Group
      this.robotGroup = new THREE.Group();
      this.robotGroup.name = "RobotType1";

      // 获取各部件的场景根节点
      this.headGroup = headGltf.scene;
      this.torsoGroup = torsoGltf.scene;
      this.leftArmGroup = leftArmGltf.scene;
      this.rightArmGroup = rightArmGltf.scene;
      this.leftLegGroup = leftLegGltf.scene;
      this.rightLegGroup = rightLegGltf.scene;

      // 为所有部件启用阴影
      applyShadows(this.headGroup);
      applyShadows(this.torsoGroup);
      applyShadows(this.leftArmGroup);
      applyShadows(this.rightArmGroup);
      applyShadows(this.leftLegGroup);
      applyShadows(this.rightLegGroup);

      // 创建并定位右肩的枢轴点 (一个空的 Group)
      this.rightArmPivot = new THREE.Group();
      this.rightArmPivot.name = "RightShoulderPivot"; // 命名以便调试
      this.rightArmPivot.position.copy(shoulderPositionOffset); // 设置枢轴在机器人坐标系中的位置

      // 将右臂模型添加到枢轴点，并设置其相对于枢轴的局部偏移
      // 这样旋转枢轴点就会带动整个手臂旋转
      this.rightArmGroup.position.copy(armPivotLocalOffset);
      this.rightArmPivot.add(this.rightArmGroup);

      // 从挥手动画器获取曲线可视化对象 (如果需要调试)
      const curveVisualObject = this.armWaveAnimator.getCurveVisualObject();
      if (curveVisualObject && this.robotGroup) {
        // 将可视化曲线的位置设置为与肩部枢轴相同 (因为曲线坐标是相对于枢轴的)
        curveVisualObject.position.copy(shoulderPositionOffset);
        this.robotGroup.add(curveVisualObject); // 添加到机器人主 Group 中
        // 可选：在这里设置曲线默认可见
        // this.setShowWaveCurve(true);
      }

      // 将所有身体部件和右臂枢轴添加到机器人主 Group
      this.robotGroup.add(this.headGroup);
      this.robotGroup.add(this.torsoGroup);
      this.robotGroup.add(this.leftArmGroup);
      this.robotGroup.add(this.rightArmPivot); // 添加的是枢轴，手臂已作为其子对象
      this.robotGroup.add(this.leftLegGroup);
      this.robotGroup.add(this.rightLegGroup);

      // 记录右肩枢轴的初始旋转姿态 (用于返回 idle 状态)
      this.initialShoulderRotation = this.rightArmPivot.rotation.clone();

      // 开始播放入场动画
      this.robotGroup.position.y = entryStartY;
      this.currentAnimation = 'entering_falling';

      // 将机器人添加到父 Group 中
      parentGroup.add(this.robotGroup);
      this.isLoaded = true;
      console.log("机器人行为：RobotType1 加载完成。");

    } catch (error) {
      console.error("机器人行为：加载机器人资源失败:", error);
    }
  }

  /** 获取机器人对象的根 Group */
  getObject(): THREE.Object3D | null {
    return this.robotGroup;
  }

  /**
   * 播放指定名称的动画。
   * @param name 动画名称 ('idle', 'wave', 'breathe', 'entering')
   * @returns 一个在动画逻辑启动后立即解析的 Promise。
   */
  playAnimation(name: AnimationName): Promise<void> {
    return new Promise((resolve) => {
      // 前置检查
      if (!this.isLoaded || !this.rightArmPivot || !this.initialShoulderRotation) {
        console.warn("机器人行为：模型未加载或手臂未初始化，无法播放动画:", name);
        resolve();
        return;
      }

      this.currentAnimation = name; // 更新当前动画状态

      // 根据请求的动画，激活对应的动画器，并停止其他可能冲突的动画器
      switch (name) {
        case 'wave':
          this.jumpAnimator.deactivate(); // 开始挥手前确保跳跃停止
          this.armWaveAnimator.activate();
          break;
        case 'jump':
          this.armWaveAnimator.deactivate(); // 开始跳跃前确保挥手停止
          this.jumpAnimator.activate();
          break;
        case 'idle':
          // 请求 idle 状态时，切换到 returning 让手臂平滑归位
          // 同时确保其他独立动画器停止
          this.jumpAnimator.deactivate();
          this.armWaveAnimator.deactivate(); // 虽然 returning 会处理，但显式停止更安全
          this.currentAnimation = 'returning';
          break;
        case 'breathe': // 呼吸动画在 update 中自动处理
        case 'entering': // 入场动画在 load 后自动开始，并在 update 中处理
          // 这两种状态不需要额外操作
          break;
        default:
          console.warn("机器人行为：未知的动画名称:", name);
          break;
      }
      resolve(); // 动画逻辑已启动或状态已设置，立即返回
    });
  }

  /**
   * 控制挥手动画曲线可视化的可见性。
   * @param show true 显示曲线, false 隐藏曲线。
   */
  public setShowWaveCurve(show: boolean): void {
    this.armWaveAnimator.setShowCurveVisual(show);
  }

  /** 将机器人立即设置为静止（idle）姿态 */
  setToRestPose(): void {
    if (this.rightArmPivot && this.initialShoulderRotation && this.robotGroup) {
      // 恢复手臂初始旋转
      this.rightArmPivot.rotation.copy(this.initialShoulderRotation);
      // 恢复机器人位置和缩放
      this.robotGroup.position.y = groundY;
      this.robotGroup.scale.set(1, 1, 1);
      // 设置状态
      this.currentAnimation = 'idle';
      // 确保所有独立动画器停止
      this.armWaveAnimator.deactivate();
      this.jumpAnimator.deactivate();
    }
  }


  /** 每帧更新逻辑 */
  update(deltaTime: number, elapsedTime: number): void {
    if (!this.isLoaded || !this.robotGroup) return; // 安全检查

    // --- 根据当前动画状态分发更新逻辑 ---
    if (this.currentAnimation.startsWith('entering')) {
      this.updateEntryAnimation(deltaTime, elapsedTime);
    } else if (this.currentAnimation === 'jump') {
      // 跳跃状态：只更新跳跃动画
      this.updateJumpAnimation(deltaTime, elapsedTime);
      // 注意：跳跃时暂停呼吸和手臂动画
    } else {
      // 其他状态 (idle, wave, returning)：应用呼吸和手臂动画
      this.applyBreathingEffect(elapsedTime);
      this.updateArmAnimation(elapsedTime);
      // 确保跳跃动画器在这些状态下是停用的 (虽然 playAnimation 和 setToRestPose 应该处理了，但多一层保险)
      this.jumpAnimator.deactivate();
    }
  }

  /** 更新入场动画状态机 */
  private updateEntryAnimation(deltaTime: number, elapsedTime: number): void {
    if (!this.robotGroup) return;

    switch (this.currentAnimation) {
      case 'entering_falling': // 下落阶段
        this.robotGroup.position.y -= fallSpeed * deltaTime;
        if (this.robotGroup.position.y <= groundY) { // 触地
          this.robotGroup.position.y = groundY;
          this.currentAnimation = 'entering_squash'; // 进入挤压阶段
          this.entryAnimTimer = 0;
          // 触地时重置手臂姿态
          if (this.rightArmPivot && this.initialShoulderRotation) {
            this.rightArmPivot.rotation.copy(this.initialShoulderRotation);
          }
        }
        break;
      case 'entering_squash': { // 挤压阶段 (添加花括号创建作用域)
        this.entryAnimTimer += deltaTime;
        const squashProgress = Math.min(this.entryAnimTimer / squashDuration, 1);
        this.robotGroup.scale.y = THREE.MathUtils.lerp(1, squashScaleY, squashProgress);
        this.robotGroup.scale.x = THREE.MathUtils.lerp(1, squashScaleXZ, squashProgress);
        this.robotGroup.scale.z = THREE.MathUtils.lerp(1, squashScaleXZ, squashProgress);
        this.robotGroup.position.y = groundY + (this.robotGroup.scale.y - 1) * -0.5; // 保持底部贴地
        if (squashProgress >= 1) { // 挤压完成
          this.currentAnimation = 'entering_stretch'; // 进入伸展阶段
          this.entryAnimTimer = 0;
        }
        break;
      } // 结束 entering_squash 作用域
      case 'entering_stretch': { // 伸展恢复阶段 (添加花括号创建作用域)
        this.entryAnimTimer += deltaTime;
        const stretchProgress = Math.min(this.entryAnimTimer / stretchDuration, 1);
        this.robotGroup.scale.y = THREE.MathUtils.lerp(squashScaleY, 1, stretchProgress);
        this.robotGroup.scale.x = THREE.MathUtils.lerp(squashScaleXZ, 1, stretchProgress);
        this.robotGroup.scale.z = THREE.MathUtils.lerp(squashScaleXZ, 1, stretchProgress);
        this.robotGroup.position.y = groundY + (this.robotGroup.scale.y - 1) * -0.5; // 保持底部贴地
        if (stretchProgress >= 1) { // 伸展完成
          this.currentAnimation = 'idle'; // 入场动画结束，进入 idle
          this.robotGroup.scale.set(1, 1, 1); // 确保缩放完全恢复
          // 计算 idle 状态下的呼吸效果初始位置
          const idleScaleY = 1 + Math.sin(elapsedTime * breathSpeed) * breathAmplitude;
          this.robotGroup.position.y = (idleScaleY - 1) * -0.5;
        }
        break;
      } // 结束 entering_stretch 作用域
    }
  }

  /** 应用呼吸效果 */
  private applyBreathingEffect(elapsedTime: number): void {
    if (!this.robotGroup) return;
    const scaleFactor = 1 + Math.sin(elapsedTime * breathSpeed) * breathAmplitude;
    this.robotGroup.scale.y = scaleFactor;
    this.robotGroup.position.y = (scaleFactor - 1) * -0.5; // 调整 Y 坐标保持底部贴地
  }

  /** 更新手臂动画状态 (wave 或 returning/idle) */
  private updateArmAnimation(elapsedTime: number): void {
    if (!this.rightArmPivot || !this.initialShoulderRotation) return;

    if (this.currentAnimation === 'wave') {
      // 委托给挥手动画器
      this.armWaveAnimator.update(elapsedTime, this.rightArmPivot);
      // 检查动画器是否已完成
      if (!this.armWaveAnimator.isActive) {
        this.currentAnimation = 'returning'; // 切换到返回状态
        console.log("机器人行为：挥手动画结束，切换到返回状态。");
      }
    } else { // returning 或 idle 状态
      // 确保挥手动画器已停用
      this.armWaveAnimator.deactivate();

      // 处理手臂返回或保持 idle 状态
      if (!this.rightArmPivot.rotation.equals(this.initialShoulderRotation)) {
        // 使用 slerp 平滑插值回到初始旋转 (比分别 lerp Euler 角度更优)
        const targetQuaternion = new THREE.Quaternion().setFromEuler(this.initialShoulderRotation);
        this.rightArmPivot.quaternion.slerp(targetQuaternion, returnLerpFactor);

        // 检查是否足够接近初始旋转 (使用四元数角度判断)
        const angleToInitial = this.rightArmPivot.quaternion.angleTo(targetQuaternion);
        const epsilon = 0.01; // 角度阈值 (弧度)

        if (angleToInitial < epsilon) {
          // 完全恢复到初始旋转并切换到 idle 状态
          this.rightArmPivot.rotation.copy(this.initialShoulderRotation); // 直接复制 Euler 保证精确
          this.currentAnimation = 'idle';
        } else {
          // 否则保持 returning 状态
          this.currentAnimation = 'returning';
        }
      } else {
        // 如果已经在初始位置，则确保状态是 idle
        this.currentAnimation = 'idle';
      }
    }
  }

  /** 更新跳跃动画状态 */
  private updateJumpAnimation(deltaTime: number, elapsedTime: number): void {
    if (!this.jumpAnimator.isActive) return; // 如果跳跃动画器未激活，则不处理

    this.jumpAnimator.update(deltaTime, elapsedTime, this.robotGroup);

    // 检查跳跃动画器是否已完成
    if (!this.jumpAnimator.isActive && this.currentAnimation === 'jump') {
      this.currentAnimation = 'idle'; // 跳跃结束后返回 idle
      console.log("机器人行为：跳跃动画结束，切换到 idle 状态。");
      // 可能需要确保手臂回到 idle 状态？setToRestPose 会处理
      this.setToRestPose(); // 跳跃后恢复静止姿态
    }
  }


  /** 清理资源 */
  dispose(): void {
    // 清理动画器的资源
    this.armWaveAnimator.dispose();
    this.jumpAnimator.dispose(); // 虽然目前为空，但保持一致性

    // 遍历并释放机器人组内所有网格的几何体和材质资源
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
    // 从父级移除机器人组
    this.robotGroup?.parent?.remove(this.robotGroup);
    // animationTimer 已移除，无需清理
    this.isLoaded = false;
    console.log("机器人行为：RobotType1Behavior 已清理。");
  }

}