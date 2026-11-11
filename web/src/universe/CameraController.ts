// 카메라 4상태 (SPEC 3-5)
// - overview: 우주 중심을 도는 조망. 드래그 회전, 휠 줌. 모든 행성이 화면에 들어오는 거리에서 시작
// - flight · flyingTo · landed: 우주인 뒤를 따라가는 시점. 드래그로 시점, 휠로 거리
import * as THREE from "three";
import type { WebState } from "@spacelog/shared/types";
import { overviewFrame, type Vec3 } from "./layout.ts";

type Mode = WebState["camera"];

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  // 조망
  private center = new THREE.Vector3();
  private fitDist = 60;
  private ovYaw = 0.6;
  private ovPitch = 0.45;
  private ovZoom = 1;
  // 따라가기
  yaw = 0;
  private pitch = 0.28;
  private dist = 9;

  private readonly look = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly wantLook = new THREE.Vector3();
  private placed = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 3000);
  }

  /** 행성 배치가 바뀌면 조망 거리 다시 계산 */
  frame(spheres: { pos: Vec3; r: number }[]): void {
    const { center, dist } = overviewFrame(spheres, this.camera.fov, this.camera.aspect);
    this.center.set(...center);
    this.fitDist = dist;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  drag(dx: number, dy: number, mode: Mode): void {
    if (mode === "overview") {
      this.ovYaw -= dx * 0.005;
      this.ovPitch = clamp(this.ovPitch + dy * 0.004, -1.2, 1.35);
    } else {
      this.yaw -= dx * 0.006;
      this.pitch = clamp(this.pitch + dy * 0.005, -1.1, 1.25);
    }
  }

  wheel(dy: number, mode: Mode): void {
    if (mode === "overview") this.ovZoom = clamp(this.ovZoom + dy * 0.001, 0.35, 2.5);
    else this.dist = clamp(this.dist + dy * 0.01, 5, 80); // DESIGN 9-4
  }

  /** 따라가기 시점의 앞 · 오른쪽 방향 (WASD 기준) */
  axes(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    return {
      forward: new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)),
      right: new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)),
    };
  }

  /** 시점을 heading 방향으로 천천히 돌린다 (자동 비행 중) */
  turnToward(heading: number, dt: number): void {
    let d = heading + Math.PI - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-2 * dt));
  }

  update(dt: number, mode: Mode, player: THREE.Vector3): void {
    if (mode === "overview") {
      const d = this.fitDist * this.ovZoom;
      const cp = Math.cos(this.ovPitch);
      this.want.set(Math.sin(this.ovYaw) * cp * d, Math.sin(this.ovPitch) * d, Math.cos(this.ovYaw) * cp * d).add(this.center);
      this.wantLook.copy(this.center);
    } else {
      this.wantLook.copy(player).y += 1.3;
      const cp = Math.cos(this.pitch);
      this.want.set(Math.sin(this.yaw) * cp * this.dist, Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * cp * this.dist).add(this.wantLook);
    }
    if (!this.placed) {
      this.camera.position.copy(this.want);
      this.look.copy(this.wantLook);
      this.placed = true;
    }
    // 상태가 바뀔 때 툭 끊기지 않게 부드럽게 옮긴다
    const k = 1 - Math.exp(-(mode === "overview" ? 4 : 8) * dt);
    this.camera.position.lerp(this.want, k);
    this.look.lerp(this.wantLook, k);
    this.camera.lookAt(this.look);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
