import * as THREE from 'three';

// --- 行走动画常量 ---
const WALK_SPEED = 2.5;       // 行走摆动速度 (频率)
const LEG_SWING_ANGLE = Math.PI / 6; // 腿部最大摆动角度 (弧度)
const ARM_SWING_ANGLE = Math.PI / 8; // 手臂最大摆动角度 (弧度)

type WalkPhase = 'inactive' | 'walking';

export class WalkAnimator {
  private phase: WalkPhase = 'inactive';
  private startTime: number = 0; // 动画开始时间

  public get isActive(): boolean {
    return this.phase !== 'inactive';
  }

  activate(): void {
    if (this.isActive) return;
    this.phase = 'walking';
    this.startTime = 0; // 会在 update 中设置
    console.log("WalkAnimator activated");
  }

  deactivate(): void {
    this.phase = 'inactive';
    console.log("WalkAnimator deactivated");
  }

  update(
    elapsedTime: number,
    leftLeg: THREE.Group | null,
    rightLeg: THREE.Group | null,
    leftArmPivot: THREE.Group | null, // 修改：接收左臂枢轴
    rightArmPivot: THREE.Group | null
  ): void {
    if (!this.isActive) return;

    // 首次进入阶段时，记录开始时间
    if (this.startTime === 0) {
      this.startTime = elapsedTime;
    }

    // 计算相对于动画开始的时间
    const walkElapsedTime = elapsedTime - this.startTime;

    // 计算摆动角度 (使用 sin 函数在 -1 到 1 之间摆动)
    const swing = Math.sin(walkElapsedTime * WALK_SPEED);

    // 应用腿部摆动 (绕 X 轴旋转)
    if (leftLeg) {
      leftLeg.rotation.x = swing * LEG_SWING_ANGLE;
    }
    if (rightLeg) {
      rightLeg.rotation.x = -swing * LEG_SWING_ANGLE; // 反方向摆动
    }

    // 应用手臂摆动 (绕 X 轴旋转)
    // 注意：手臂的初始旋转可能不是 0，理想情况下应该记录初始旋转并在其基础上摆动
    // 但为了简化，这里直接设置旋转值，假设初始 X 旋转接近 0
    if (leftArmPivot) { // 修改：使用 leftArmPivot
      // 简化处理：直接设置，可能会覆盖其他旋转，且效果依赖初始姿态
      leftArmPivot.rotation.x = -swing * ARM_SWING_ANGLE; // 与左腿反方向
      // 如果需要更精确控制，应该传入 initialLeftShoulderRotation.x
      // leftArmPivot.rotation.x = initialLeftShoulderRotation.x - swing * ARM_SWING_ANGLE;
    }
    if (rightArmPivot) {
      // 假设 rightArmPivot 的初始 X 旋转是 initialShoulderRotation.x
      // 我们需要在其基础上叠加摆动，但这需要从 Behavior 传入 initialRotation
      // 简化处理：直接设置，可能会覆盖其他旋转，且效果依赖初始姿态
      rightArmPivot.rotation.x = swing * ARM_SWING_ANGLE; // 与右腿反方向
      // 如果需要更精确控制，应该传入 initialShoulderRotation.x
      // rightArmPivot.rotation.x = initialShoulderRotation.x + swing * ARM_SWING_ANGLE;
    }

    // 行走动画通常是持续的，除非被外部停止 (deactivate)
    // 如果需要固定时长的行走，可以在 activate 时传入 duration，并在 update 中检查
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
    if (leftLeg) leftLeg.rotation.x = 0; // 假设初始为0
    if (rightLeg) rightLeg.rotation.x = 0; // 假设初始为0
    if (leftArmPivot && initialLeftShoulderRotation) { // 修改：使用 leftArmPivot 和 initialLeftShoulderRotation
      leftArmPivot.rotation.copy(initialLeftShoulderRotation); // 恢复记录的初始姿态
    }
    if (rightArmPivot && initialRightShoulderRotation) { // 修改：使用 initialRightShoulderRotation
      rightArmPivot.rotation.copy(initialRightShoulderRotation); // 恢复记录的初始姿态
    }
  }


  dispose(): void {
    // 目前 WalkAnimator 没有需要特殊清理的资源
    console.log("WalkAnimator disposed.");
  }
}