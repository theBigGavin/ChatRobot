import * as THREE from 'three';

// --- 奔跑动画常量 ---
const RUN_SPEED = 5.0;       // 奔跑摆动速度 (频率，比行走快)
const LEG_SWING_ANGLE = Math.PI / 4; // 腿部最大摆动角度 (比行走大)
const ARM_SWING_ANGLE = Math.PI / 5; // 手臂最大摆动角度 (比行走大)

type RunPhase = 'inactive' | 'running';

export class RunAnimator {
  private phase: RunPhase = 'inactive';
  private startTime: number = 0; // 动画开始时间

  public get isActive(): boolean {
    return this.phase !== 'inactive';
  }

  activate(): void {
    if (this.isActive) return;
    this.phase = 'running';
    this.startTime = 0; // 会在 update 中设置
    console.log("RunAnimator activated");
  }

  deactivate(): void {
    this.phase = 'inactive';
    console.log("RunAnimator deactivated");
  }

  update(
    elapsedTime: number,
    leftLeg: THREE.Group | null,
    rightLeg: THREE.Group | null,
    leftArmPivot: THREE.Group | null, // 修改：接收左臂枢轴
    rightArmPivot: THREE.Group | null
    // initialLeftShoulderRotation: THREE.Euler | null, // 暂时不需要，简化处理
    // initialRightShoulderRotation: THREE.Euler | null
  ): void {
    if (!this.isActive) return;

    // 首次进入阶段时，记录开始时间
    if (this.startTime === 0) {
      this.startTime = elapsedTime;
    }

    // 计算相对于动画开始的时间
    const runElapsedTime = elapsedTime - this.startTime;

    // 计算摆动角度 (使用 sin 函数在 -1 到 1 之间摆动)
    const swing = Math.sin(runElapsedTime * RUN_SPEED);

    // 应用腿部摆动 (绕 X 轴旋转)
    if (leftLeg) {
      leftLeg.rotation.x = swing * LEG_SWING_ANGLE;
    }
    if (rightLeg) {
      rightLeg.rotation.x = -swing * LEG_SWING_ANGLE; // 反方向摆动
    }

    // 应用手臂摆动 (绕 X 轴旋转)
    // 简化处理：直接设置旋转值
    if (leftArmPivot) { // 修改：使用 leftArmPivot
      // 简化处理：直接设置 X 轴旋转
      // 如果需要基于初始姿态摆动，需要传入 initialLeftShoulderRotation.x
      leftArmPivot.rotation.x = -swing * ARM_SWING_ANGLE; // 与左腿反方向
    }
    if (rightArmPivot) {
      // 同样，简化处理，直接设置 X 轴旋转
      // 如果需要基于初始姿态摆动，需要传入 initialRightShoulderRotation.x
      rightArmPivot.rotation.x = swing * ARM_SWING_ANGLE; // 与右腿反方向
    }

    // 奔跑动画也是持续的，除非被外部停止
  }

  resetPose(
    leftLeg: THREE.Group | null,
    rightLeg: THREE.Group | null,
    leftArmPivot: THREE.Group | null, // 修改：接收左臂枢轴
    rightArmPivot: THREE.Group | null,
    initialLeftShoulderRotation: THREE.Euler | null, // 修改：接收左肩初始旋转
    initialRightShoulderRotation: THREE.Euler | null // 修改：接收右肩初始旋转
  ): void {
    // 将腿和手臂恢复到初始或接近初始的姿态
    if (leftLeg) leftLeg.rotation.x = 0;
    if (rightLeg) rightLeg.rotation.x = 0;
    if (leftArmPivot && initialLeftShoulderRotation) { // 修改：使用 leftArmPivot 和 initialLeftShoulderRotation
      leftArmPivot.rotation.copy(initialLeftShoulderRotation);
    }
    if (rightArmPivot && initialRightShoulderRotation) { // 修改：使用 initialRightShoulderRotation
      rightArmPivot.rotation.copy(initialRightShoulderRotation);
    }
  }


  dispose(): void {
    // 目前 RunAnimator 没有需要特殊清理的资源
    console.log("RunAnimator disposed.");
  }
}