import * as THREE from 'three';

// --- 跳跃动画常量 ---
const PREPARE_DURATION = 0.15; // 准备下蹲持续时间 (秒)
const ASCEND_DURATION = 0.3;  // 上升持续时间 (秒)
const DESCEND_DURATION = 0.35; // 下落持续时间 (秒)
const LAND_SQUASH_DURATION = 0.1; // 落地挤压持续时间 (秒)
const LAND_STRETCH_DURATION = 0.15;// 落地恢复持续时间 (秒)

const JUMP_HEIGHT = 1.5; // 跳跃最大高度
const GROUND_Y = 0;    // 地面 Y 坐标 (与 Behavior 中保持一致)

// 挤压/伸展的缩放比例 (可以复用 Behavior 中的常量或单独定义)
const SQUASH_SCALE_Y = 0.8;
const SQUASH_SCALE_XZ = 1.1;
// const STRETCH_SCALE_Y = 1.1; // 暂不使用伸展效果
// const STRETCH_SCALE_XZ = 0.9;

type JumpPhase = 'inactive' | 'preparing' | 'ascending' | 'descending' | 'landing_squash' | 'landing_stretch';

export class JumpAnimator {
  private phase: JumpPhase = 'inactive';
  private startTime: number = 0; // 当前阶段开始时间
  private timer: number = 0;     // 当前阶段计时器

  public get isActive(): boolean {
    return this.phase !== 'inactive';
  }

  activate(): void {
    if (this.isActive) return; // 防止重复激活
    this.phase = 'preparing';
    this.timer = 0;
    // startTime 会在 update 中设置
    console.log("JumpAnimator activated");
  }

  deactivate(): void {
    this.phase = 'inactive';
    console.log("JumpAnimator deactivated");
  }

  update(deltaTime: number, elapsedTime: number, robotGroup: THREE.Group | null): void {
    if (!this.isActive || !robotGroup) {
      console.log(`JumpAnimator update skipped: isActive=${this.isActive}, robotGroup=${!!robotGroup}`); // 调试日志1: 检查是否跳过更新 (取消注释)
      return;
    }

    // 首次进入阶段时，记录开始时间
    if (this.timer === 0) {
      this.startTime = elapsedTime;
    }
    this.timer += deltaTime;
    console.log(`Jump phase: ${this.phase}, timer: ${this.timer.toFixed(3)}, deltaTime: ${deltaTime.toFixed(6)}`); // 调试日志2: 打印当前阶段、计时器和deltaTime (取消注释)

    let progress = 0;

    switch (this.phase) {
      case 'preparing': // 准备下蹲
        progress = Math.min(this.timer / PREPARE_DURATION, 1);
        robotGroup.scale.y = THREE.MathUtils.lerp(1, SQUASH_SCALE_Y, progress);
        robotGroup.scale.x = THREE.MathUtils.lerp(1, SQUASH_SCALE_XZ, progress);
        robotGroup.scale.z = THREE.MathUtils.lerp(1, SQUASH_SCALE_XZ, progress);
        // 假设枢轴在底部，挤压时不改变 Y 坐标
        robotGroup.position.y = GROUND_Y;
        // console.log(`Preparing: progress=${progress.toFixed(2)}, scaleY=${robotGroup.scale.y.toFixed(2)}, posY=${robotGroup.position.y.toFixed(2)}`); // 调试日志3: 准备阶段值
        if (progress >= 1) {
          // 准备阶段完成，切换状态，但不在这里重置缩放
          this.phase = 'ascending';
          this.timer = 0; // 重置计时器进入下一阶段
        }
        break;

      case 'ascending': { // 上升阶段 (添加花括号)
        // 在上升阶段开始时，确保缩放是正常的 (从 preparing 结束时的挤压状态恢复)
        if (this.timer === deltaTime) { // 检查是否是该阶段的第一帧
          robotGroup.scale.set(1, 1, 1);
        }
        progress = Math.min(this.timer / ASCEND_DURATION, 1);
        // 使用 easeOutQuad 缓动函数模拟加速上升然后减速
        const easeOutProgress = progress * (2 - progress);
        robotGroup.position.y = GROUND_Y + JUMP_HEIGHT * easeOutProgress;
        // 可以选择在上升时稍微拉伸
        // robotGroup.scale.y = THREE.MathUtils.lerp(SQUASH_SCALE_Y, STRETCH_SCALE_Y, progress);
        // robotGroup.scale.x = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, STRETCH_SCALE_XZ, progress);
        // robotGroup.scale.z = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, STRETCH_SCALE_XZ, progress);
        // 在空中保持正常缩放
        // robotGroup.scale.y = THREE.MathUtils.lerp(SQUASH_SCALE_Y, 1, progress);
        // robotGroup.scale.x = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, 1, progress);
        // robotGroup.scale.z = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, 1, progress);
        // console.log(`Ascending: progress=${progress.toFixed(2)}, easeOut=${easeOutProgress.toFixed(2)}, posY=${robotGroup.position.y.toFixed(2)}`); // 调试日志4: 上升阶段值

        if (progress >= 1) {
          this.phase = 'descending';
          this.timer = 0;
        }
        break;
      } // 结束 ascending 作用域

      case 'descending': { // 下落阶段 (添加花括号)
        progress = Math.min(this.timer / DESCEND_DURATION, 1);
        // 使用 easeInQuad 缓动函数模拟加速下落
        const easeInProgress = progress * progress;
        robotGroup.position.y = GROUND_Y + JUMP_HEIGHT * (1 - easeInProgress);
        // console.log(`Descending: progress=${progress.toFixed(2)}, easeIn=${easeInProgress.toFixed(2)}, posY=${robotGroup.position.y.toFixed(2)}`); // 调试日志5: 下落阶段值
        // 在空中保持正常缩放
        // robotGroup.scale.y = THREE.MathUtils.lerp(STRETCH_SCALE_Y, 1, progress);
        // robotGroup.scale.x = THREE.MathUtils.lerp(STRETCH_SCALE_XZ, 1, progress);
        // robotGroup.scale.z = THREE.MathUtils.lerp(STRETCH_SCALE_XZ, 1, progress);

        if (progress >= 1) {
          robotGroup.position.y = GROUND_Y; // 确保精确落地
          this.phase = 'landing_squash';
          this.timer = 0;
        }
        break;
      } // 结束 descending 作用域

      case 'landing_squash': // 落地挤压
        progress = Math.min(this.timer / LAND_SQUASH_DURATION, 1);
        robotGroup.scale.y = THREE.MathUtils.lerp(1, SQUASH_SCALE_Y, progress);
        robotGroup.scale.x = THREE.MathUtils.lerp(1, SQUASH_SCALE_XZ, progress);
        robotGroup.scale.z = THREE.MathUtils.lerp(1, SQUASH_SCALE_XZ, progress);
        // 假设枢轴在底部，挤压时不改变 Y 坐标
        robotGroup.position.y = GROUND_Y;
        // console.log(`Landing Squash: progress=${progress.toFixed(2)}, scaleY=${robotGroup.scale.y.toFixed(2)}, posY=${robotGroup.position.y.toFixed(2)}`); // 调试日志6: 落地挤压值
        if (progress >= 1) {
          this.phase = 'landing_stretch';
          this.timer = 0;
        }
        break;

      case 'landing_stretch': // 落地恢复
        progress = Math.min(this.timer / LAND_STRETCH_DURATION, 1);
        robotGroup.scale.y = THREE.MathUtils.lerp(SQUASH_SCALE_Y, 1, progress);
        robotGroup.scale.x = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, 1, progress);
        robotGroup.scale.z = THREE.MathUtils.lerp(SQUASH_SCALE_XZ, 1, progress);
        // 假设枢轴在底部，恢复时不改变 Y 坐标
        robotGroup.position.y = GROUND_Y;
        // console.log(`Landing Stretch: progress=${progress.toFixed(2)}, scaleY=${robotGroup.scale.y.toFixed(2)}, posY=${robotGroup.position.y.toFixed(2)}`); // 调试日志7: 落地恢复值
        if (progress >= 1) {
          robotGroup.scale.set(1, 1, 1); // 确保完全恢复
          robotGroup.position.y = GROUND_Y;
          this.deactivate(); // 动画结束
        }
        break;
    }
  }

  dispose(): void {
    // 目前 JumpAnimator 没有需要特殊清理的资源
    console.log("JumpAnimator disposed.");
  }
}