// src/behaviors/RobotType1Behavior.ts
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IRobotBehavior, AnimationName } from '../types/robot';
import { ArmWaveAnimator } from '../animations/ArmWaveAnimator'; // 导入挥手动画器
import { JumpAnimator } from '../animations/JumpAnimator';     // 导入跳跃动画器
import { WalkAnimator } from '../animations/WalkAnimator';     // 导入行走动画器
import { RunAnimator } from '../animations/RunAnimator';       // 导入奔跑动画器

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
  private leftArmPivot: THREE.Group | null = null;  // 左肩枢轴点 (用于旋转手臂)
  private leftLegGroup: THREE.Group | null = null; // 左腿模型组
  private rightLegGroup: THREE.Group | null = null; // 右腿模型组

  private initialRightShoulderRotation: THREE.Euler | null = null; // 右肩初始旋转
  private initialLeftShoulderRotation: THREE.Euler | null = null; // 左肩初始旋转
  private currentAnimation: AnimationName | 'returning' | 'entering_falling' | 'entering_squash' | 'entering_stretch' = 'idle'; // 当前动画状态
  private entryAnimTimer = 0; // 入场动画内部计时器
  private isLoaded = false; // 模型是否加载完成标志

  // --- 动画器实例 ---
  private armWaveAnimator = new ArmWaveAnimator(); // 挥手动画器实例
  private jumpAnimator = new JumpAnimator();     // 跳跃动画器实例
  private walkAnimator = new WalkAnimator();     // 行走动画器实例
  private runAnimator = new RunAnimator();       // 奔跑动画器实例
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

      // --- 设置右臂枢轴 ---
      this.rightArmPivot = new THREE.Group();
      this.rightArmPivot.name = "RightShoulderPivot";
      this.rightArmPivot.position.copy(shoulderPositionOffset); // 使用通用肩部偏移
      if (this.rightArmGroup) {
        this.rightArmGroup.position.copy(armPivotLocalOffset); // 使用通用手臂局部偏移
        this.rightArmPivot.add(this.rightArmGroup);
      }

      // --- 设置左臂枢轴 ---
      this.leftArmPivot = new THREE.Group();
      this.leftArmPivot.name = "LeftShoulderPivot";
      // 假设左右对称，使用相同的 Y/Z 偏移，X 轴可能需要反转，但当前偏移 X 为 0
      const leftShoulderPositionOffset = shoulderPositionOffset.clone();
      // 如果需要左右对称，可以反转 X 轴偏移: leftShoulderPositionOffset.x *= -1;
      this.leftArmPivot.position.copy(leftShoulderPositionOffset);
      // 假设左右对称，使用相同的手臂局部偏移
      const leftArmPivotLocalOffset = armPivotLocalOffset.clone();
      // 如果需要左右对称，可以反转 X 轴偏移: leftArmPivotLocalOffset.x *= -1;
      if (this.leftArmGroup) {
        this.leftArmGroup.position.copy(leftArmPivotLocalOffset);
        this.leftArmPivot.add(this.leftArmGroup);
      }


      // 从挥手动画器获取曲线可视化对象 (如果需要调试)
      const curveVisualObject = this.armWaveAnimator.getCurveVisualObject();
      if (curveVisualObject && this.robotGroup) {
        // 将可视化曲线的位置设置为与右肩部枢轴相同 (因为挥手只影响右臂)
        curveVisualObject.position.copy(shoulderPositionOffset);
        this.robotGroup.add(curveVisualObject); // 添加到机器人主 Group 中
        // 可选：在这里设置曲线默认可见
        // this.setShowWaveCurve(true);
      }

      // 将所有身体部件以及左右臂的枢轴添加到机器人主 Group
      if (this.headGroup) this.robotGroup.add(this.headGroup);
      if (this.torsoGroup) this.robotGroup.add(this.torsoGroup);
      if (this.leftArmPivot) this.robotGroup.add(this.leftArmPivot);  // 添加左臂枢轴
      if (this.rightArmPivot) this.robotGroup.add(this.rightArmPivot); // 添加右臂枢轴
      if (this.leftLegGroup) this.robotGroup.add(this.leftLegGroup);
      if (this.rightLegGroup) this.robotGroup.add(this.rightLegGroup);

      // 记录左右肩枢轴的初始旋转姿态
      if (this.rightArmPivot) this.initialRightShoulderRotation = this.rightArmPivot.rotation.clone();
      if (this.leftArmPivot) this.initialLeftShoulderRotation = this.leftArmPivot.rotation.clone();


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
   * @param name 动画名称 ('idle', 'wave', 'breathe', 'entering', 'jump', 'walk', 'run')
   * @returns 一个在动画逻辑启动后立即解析的 Promise。
   */
  playAnimation(name: AnimationName): Promise<void> {
    return new Promise((resolve) => {
      // 前置检查 (检查左右枢轴和初始旋转)
      if (!this.isLoaded || !this.rightArmPivot || !this.leftArmPivot || !this.initialRightShoulderRotation || !this.initialLeftShoulderRotation) {
        console.warn("机器人行为：模型未加载或手臂未完全初始化，无法播放动画:", name);
        resolve();
        return;
      }

      // 如果请求的动画已经是当前动画 (且不是可重复触发的，如 breathe/entering)，则直接返回
      // 注意：对于持续性动画如 walk/run，重复调用 activate 通常是无害的
      // if (name === this.currentAnimation && name !== 'breathe' && name !== 'entering') {
      //   resolve();
      //   return;
      // }

      this.currentAnimation = name; // 更新当前动画状态

      // 根据请求的动画，激活对应的动画器，并停止其他可能冲突的动画器
      switch (name) {
        case 'wave':
          this.jumpAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.deactivate();
          this.armWaveAnimator.activate();
          break;
        case 'jump':
          this.armWaveAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.deactivate();
          this.jumpAnimator.activate();
          break;
        case 'walk':
          this.armWaveAnimator.deactivate();
          this.jumpAnimator.deactivate();
          this.runAnimator.deactivate();
          this.walkAnimator.activate();
          break;
        case 'run':
          this.armWaveAnimator.deactivate();
          this.jumpAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.activate();
          break;
        case 'idle':
          // 请求 idle 状态时，切换到 returning 让手臂/腿平滑归位
          // 同时确保所有独立动画器停止
          this.jumpAnimator.deactivate();
          this.armWaveAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.deactivate();
          this.currentAnimation = 'returning';
          break;
        case 'breathe': // 呼吸动画在 update 中自动处理
        case 'entering': // 入场动画在 load 后自动开始，并在 update 中处理
          // 这两种状态不需要额外操作，但要确保其他动画器停止
          this.jumpAnimator.deactivate();
          this.armWaveAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.deactivate();
          break;
        default:
          console.warn("机器人行为：未知的动画名称:", name);
          // 停止所有动画器以防万一
          this.jumpAnimator.deactivate();
          this.armWaveAnimator.deactivate();
          this.walkAnimator.deactivate();
          this.runAnimator.deactivate();
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
    if (this.robotGroup && this.rightArmPivot && this.initialRightShoulderRotation && this.leftArmPivot && this.initialLeftShoulderRotation) {
      // 恢复手臂初始旋转
      this.rightArmPivot.rotation.copy(this.initialRightShoulderRotation);
      this.leftArmPivot.rotation.copy(this.initialLeftShoulderRotation); // 恢复左臂旋转
      // 恢复机器人位置和缩放
      this.robotGroup.position.y = groundY;
      this.robotGroup.scale.set(1, 1, 1);
      // 设置状态
      this.currentAnimation = 'idle';
      // 确保所有独立动画器停止
      this.armWaveAnimator.deactivate();
      this.jumpAnimator.deactivate();
      this.walkAnimator.deactivate();
      this.runAnimator.deactivate();
      // 重置行走/奔跑姿态 (传递左右臂枢轴和对应初始旋转)
      this.walkAnimator.resetPose(this.leftLegGroup, this.rightLegGroup, this.leftArmPivot, this.rightArmPivot, this.initialLeftShoulderRotation, this.initialRightShoulderRotation);
      this.runAnimator.resetPose(this.leftLegGroup, this.rightLegGroup, this.leftArmPivot, this.rightArmPivot, this.initialLeftShoulderRotation, this.initialRightShoulderRotation);
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
      // 注意：跳跃时暂停呼吸和手臂/腿部动画
    } else if (this.currentAnimation === 'walk') {
      // 行走状态：只更新行走动画
      this.updateWalkAnimation(elapsedTime);
      // 注意：行走时暂停呼吸（避免冲突）和独立的挥手动画
    } else if (this.currentAnimation === 'run') {
      // 奔跑状态：只更新奔跑动画
      this.updateRunAnimation(elapsedTime);
      // 注意：奔跑时暂停呼吸和独立的挥手动画
    } else {
      // 其他状态 (idle, wave, returning)：应用呼吸和手臂动画
      this.applyBreathingEffect(elapsedTime);
      this.updateArmAnimation(elapsedTime); // 处理挥手或返回 idle
      // 确保跳跃、行走和奔跑动画器在这些状态下是停用的
      this.jumpAnimator.deactivate();
      this.walkAnimator.deactivate();
      this.runAnimator.deactivate();
      // 重置行走/奔跑姿态 (确保非行走/奔跑状态下肢体归位)
      this.walkAnimator.resetPose(this.leftLegGroup, this.rightLegGroup, this.leftArmPivot, this.rightArmPivot, this.initialLeftShoulderRotation, this.initialRightShoulderRotation);
      this.runAnimator.resetPose(this.leftLegGroup, this.rightLegGroup, this.leftArmPivot, this.rightArmPivot, this.initialLeftShoulderRotation, this.initialRightShoulderRotation);
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
          if (this.rightArmPivot && this.initialRightShoulderRotation) {
            this.rightArmPivot.rotation.copy(this.initialRightShoulderRotation);
          }
          if (this.leftArmPivot && this.initialLeftShoulderRotation) {
            this.leftArmPivot.rotation.copy(this.initialLeftShoulderRotation);
          }
        }
        break;
      case 'entering_squash': { // 挤压阶段
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
      }
      case 'entering_stretch': { // 伸展恢复阶段
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
      }
    }
  }

  /** 应用呼吸效果 */
  private applyBreathingEffect(elapsedTime: number): void {
    if (!this.robotGroup) return;
    const scaleFactor = 1 + Math.sin(elapsedTime * breathSpeed) * breathAmplitude;
    this.robotGroup.scale.y = scaleFactor;
    this.robotGroup.position.y = (scaleFactor - 1) * -0.5; // 调整 Y 坐标保持底部贴地
  }

  /** 更新手臂动画状态 (wave 或 returning/idle)，主要处理右臂挥手和左右臂归位 */
  private updateArmAnimation(elapsedTime: number): void {
    let rightArmAtRest = true;
    let leftArmAtRest = true;

    // 右臂挥手或归位
    if (this.rightArmPivot && this.initialRightShoulderRotation) {
      if (this.currentAnimation === 'wave') {
        rightArmAtRest = false; // 正在挥手，肯定不在静止状态
        // 委托给挥手动画器 (只影响右臂)
        this.armWaveAnimator.update(elapsedTime, this.rightArmPivot);
        // 检查动画器是否已完成
        if (!this.armWaveAnimator.isActive) {
          this.currentAnimation = 'returning'; // 切换到返回状态
          console.log("机器人行为：挥手动画结束，切换到返回状态。");
        }
      } else { // returning 或 idle 状态 (右臂)
        // 确保挥手动画器已停用
        this.armWaveAnimator.deactivate();
        // 处理右臂返回或保持 idle 状态
        if (!this.rightArmPivot.rotation.equals(this.initialRightShoulderRotation)) {
          rightArmAtRest = false; // 正在返回，不在静止状态
          const targetQuaternion = new THREE.Quaternion().setFromEuler(this.initialRightShoulderRotation);
          this.rightArmPivot.quaternion.slerp(targetQuaternion, returnLerpFactor);

          const angleToInitial = this.rightArmPivot.quaternion.angleTo(targetQuaternion);
          const epsilon = 0.01;
          if (angleToInitial < epsilon) {
            this.rightArmPivot.rotation.copy(this.initialRightShoulderRotation); // 直接复制 Euler 保证精确
            rightArmAtRest = true; // 已到达静止状态
          } else {
            this.currentAnimation = 'returning'; // 保持 returning
          }
        } else {
          rightArmAtRest = true; // 已经在静止状态
        }
      }
    }

    // 左臂归位 (在 returning 或 idle 状态下)
    if (this.leftArmPivot && this.initialLeftShoulderRotation && (this.currentAnimation === 'returning' || this.currentAnimation === 'idle')) {
      if (!this.leftArmPivot.rotation.equals(this.initialLeftShoulderRotation)) {
        leftArmAtRest = false; // 正在返回，不在静止状态
        const targetQuaternion = new THREE.Quaternion().setFromEuler(this.initialLeftShoulderRotation);
        this.leftArmPivot.quaternion.slerp(targetQuaternion, returnLerpFactor);

        const angleToInitial = this.leftArmPivot.quaternion.angleTo(targetQuaternion);
        const epsilon = 0.01;
        if (angleToInitial < epsilon) {
          this.leftArmPivot.rotation.copy(this.initialLeftShoulderRotation); // 直接复制 Euler 保证精确
          leftArmAtRest = true; // 已到达静止状态
        } else {
          this.currentAnimation = 'returning'; // 保持 returning
        }
      } else {
        leftArmAtRest = true; // 已经在静止状态
      }
    } else if (!this.leftArmPivot || !this.initialLeftShoulderRotation) {
      // 如果没有左臂或初始旋转信息，也视为静止（或忽略）
      leftArmAtRest = true;
    }


    // 检查是否所有部件都已归位，如果是，则切换到 idle
    if (this.currentAnimation === 'returning' && rightArmAtRest && leftArmAtRest) {
      this.currentAnimation = 'idle';
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

  /** 更新行走动画状态 */
  private updateWalkAnimation(elapsedTime: number): void {
    if (!this.walkAnimator.isActive) return;

    // 委托给行走动画器，传入需要的肢体引用和初始旋转
    this.walkAnimator.update(
      elapsedTime,
      this.leftLegGroup,
      this.rightLegGroup,
      this.leftArmPivot, // 传递左臂枢轴
      this.rightArmPivot // 传递右臂枢轴
      // 初始旋转信息不需要传递给 update 方法
    );

    // WalkAnimator 目前是持续动画，没有内部结束逻辑
    // 如果需要，可以在这里添加外部停止条件
  }

  /** 更新奔跑动画状态 */
  private updateRunAnimation(elapsedTime: number): void {
    if (!this.runAnimator.isActive) return;

    // 委托给奔跑动画器 (传递左臂枢轴和初始旋转)
    this.runAnimator.update(
      elapsedTime,
      this.leftLegGroup,
      this.rightLegGroup,
      this.leftArmPivot, // 传递左臂枢轴
      this.rightArmPivot // 传递右臂枢轴
      // 初始旋转信息不需要传递给 update 方法
    );
    // RunAnimator 目前也是持续动画
  }


  /** 清理资源 */
  dispose(): void {
    // 清理动画器的资源
    this.armWaveAnimator.dispose();
    this.jumpAnimator.dispose();
    this.walkAnimator.dispose();
    this.runAnimator.dispose(); // 添加奔跑动画器的清理

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