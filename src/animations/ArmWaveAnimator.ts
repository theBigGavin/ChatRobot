import * as THREE from 'three';

// --- Curve Definition ---
// 调整曲线点以实现 "举起再落下" 的效果 (数值可能需要微调)
const fingertipStartLocal = new THREE.Vector3(0, 0, 1);    // 起点: 较低，稍靠前
const fingertipEndLocal = new THREE.Vector3(0.2, 0.2, 0.8);  // 终点: 也较低，位置略有变化
const fingertipControl1Local = new THREE.Vector3(1, 50, 0.5); // 控制点1: 很高，稍向右
const fingertipControl2Local = new THREE.Vector3(-0.1, 26, 0.3);// 控制点2: 也很高，稍向左

const fingertipPathCurve = new THREE.CubicBezierCurve3(
  fingertipStartLocal,
  fingertipControl1Local,
  fingertipControl2Local,
  fingertipEndLocal
);

const LOOK_AT_LERP_FACTOR = 0.1; // 平滑系数
const DEFAULT_WAVE_DURATION_MS = 8000; // 默认持续时间 (毫秒)

export class ArmWaveAnimator {
  private _isActive: boolean = false; // Rename to avoid conflict with getter
  private startTime: number | null = null;
  private duration: number = DEFAULT_WAVE_DURATION_MS / 1000; // Store duration in seconds
  private smoothedLookAtTarget = new THREE.Vector3();
  private isLookAtTargetInitialized = false;

  // Curve is defined internally for now, could be passed in constructor if needed
  private curve = fingertipPathCurve;
  private curveVisual: THREE.Line | null = null; // Hold the visual object
  private _showCurve: boolean = false; // Flag to control visibility

  // Public getter for isActive state
  public get isActive(): boolean {
    return this._isActive;
  }

  activate(durationMs: number = DEFAULT_WAVE_DURATION_MS): void {
    this._isActive = true; // Use renamed private property
    this.duration = durationMs / 1000; // Convert ms to seconds
    this.startTime = null; // Will be set on the first update call
    this.isLookAtTargetInitialized = false;
    console.log(`ArmWaveAnimator activated for ${this.duration} seconds`);
  }

  deactivate(): void {
    this._isActive = false; // Use renamed private property
    console.log("ArmWaveAnimator deactivated");
  }

  /**
   * Sets whether the curve visualization should be shown.
   * @param show True to show the curve, false to hide it.
   */
  setShowCurveVisual(show: boolean): void {
    this._showCurve = show;
    if (this.curveVisual) {
      this.curveVisual.visible = this._showCurve;
    }
  }

  /**
   * Gets the curve visualization object (THREE.Line).
   * Creates it if it doesn't exist yet.
   * @returns The THREE.Line object or null if creation fails.
   */
  getCurveVisualObject(): THREE.Object3D | null {
    if (!this.curveVisual) {
      try {
        const points = this.curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0xff00ff, // Magenta
          transparent: true,
          opacity: 0.8,
          linewidth: 2, // Make it slightly thicker
        });
        this.curveVisual = new THREE.Line(geometry, material);
        this.curveVisual.name = "ArmWaveCurveVisual";
        this.curveVisual.visible = this._showCurve; // Set initial visibility
      } catch (error) {
        console.error("Failed to create curve visual:", error);
        return null;
      }
    }
    return this.curveVisual;
  }

  /**
   * Cleans up resources used by the animator, specifically the curve visual.
   */
  dispose(): void {
    if (this.curveVisual) {
      this.curveVisual.geometry?.dispose();
      if (this.curveVisual.material instanceof THREE.Material) {
        this.curveVisual.material.dispose();
      }
      // No need to remove from parent here, RobotType1Behavior should handle that
      this.curveVisual = null;
      console.log("ArmWaveAnimator disposed curve visual.");
    }
  }


  update(elapsedTime: number, armPivot: THREE.Group | null): void {
    if (!this._isActive || !armPivot) { // Use renamed private property
      return;
    }

    // Capture start time on the first frame after activation
    if (this.startTime === null) {
      this.startTime = elapsedTime;
      console.log("ArmWaveAnimator started at:", this.startTime);
    }

    // Calculate elapsed time relative to the start of this animation instance
    const waveElapsedTime = elapsedTime - this.startTime;

    // Check if duration has been reached
    if (waveElapsedTime >= this.duration) {
      this.deactivate();
      console.log("ArmWaveAnimator duration reached, deactivating.");
      return; // Stop updating if duration is over
    }

    // Calculate target point on the curve based on relative time
    const p = (Math.sin(waveElapsedTime * 0.5) + 1) / 2; // Oscillates between 0 and 1
    const currentTargetPoint = this.curve.getPoint(p);

    // Initialize or interpolate the smoothed target point
    if (!this.isLookAtTargetInitialized) {
      this.smoothedLookAtTarget.copy(currentTargetPoint);
      this.isLookAtTargetInitialized = true;
    } else {
      this.smoothedLookAtTarget.lerp(currentTargetPoint, LOOK_AT_LERP_FACTOR);
    }

    // Apply lookAt to the arm pivot
    // Assuming lookAt handles coordinate transformations correctly for now
    armPivot.lookAt(this.smoothedLookAtTarget);
  }
}