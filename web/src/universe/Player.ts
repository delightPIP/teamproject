// 비행 모드에서 사용자가 조종하는 우주인 캐릭터 (3D 시안에서 옮김).
import * as THREE from "three";
import { cssColor, type Toon } from "./toon.ts";

const PUFFS = 40;

export class Player {
  readonly root = new THREE.Group();
  private readonly yaw = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly antBall: THREE.Mesh;
  private readonly puffs: { m: THREE.Mesh; life: number }[] = [];
  private puffIdx = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(toon: Toon, scene: THREE.Scene) {
    const WHITE = cssColor("panel", "#f3f1ff");
    const YEL = cssColor("yellow", "#ffd23f");
    const PINK = cssColor("pink", "#ff5d8f");
    const VIO = cssColor("violet", "#7a6cff");
    const INK = toon.ink;
    const sph = (r: number, w = 22, h = 16) => new THREE.SphereGeometry(r, w, h);
    const P = toon.part.bind(toon);
    const L = this.lean;

    this.root.add(this.yaw);
    this.yaw.add(L);
    P(L, sph(0.55), WHITE, [0, 0, 0], [1, 1.05, 0.92]);
    P(L, new THREE.TorusGeometry(0.5, 0.085, 8, 28), YEL, [0, -0.14, 0], null, 1.12).rotation.x = Math.PI / 2;
    P(L, new THREE.BoxGeometry(0.4, 0.24, 0.12), PINK, [0, 0.14, 0.5], null, 1.12);
    P(L, sph(0.78, 28, 20), WHITE, [0, 1.05, 0]);
    P(L, sph(0.6), 0x2b2f6b, [0, 1.02, 0.38], [1, 0.72, 0.62], 1.07);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ff3ff });
    for (const x of [-0.19, 0.19]) {
      const e = new THREE.Mesh(sph(0.075, 10, 8), eyeMat);
      e.position.set(x, 1.05, 0.77);
      e.scale.set(1, 1.7, 0.5);
      L.add(e);
      this.eyes.push(e);
    }
    const shine = new THREE.Mesh(sph(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.26, 1.24, 0.68);
    shine.scale.set(1.3, 0.6, 0.4);
    L.add(shine);
    for (const s of [-1, 1]) P(L, new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16), YEL, [s * 0.78, 1.05, 0], null, 1.15).rotation.z = Math.PI / 2;
    P(L, new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), INK, [0.3, 1.95, 0], null, 0).rotation.z = -0.35;
    this.antBall = P(L, sph(0.13, 12, 10), PINK, [0.4, 2.22, 0], null, 1.15);
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(s * 0.6, 0.18, 0);
      L.add(a);
      P(a, sph(0.2), WHITE, [s * 0.04, -0.18, 0], [1, 1.45, 1]);
      P(a, sph(0.19), YEL, [s * 0.07, -0.46, 0.02]);
      this.arms.push(a);
      const l = new THREE.Group();
      l.position.set(s * 0.24, -0.5, 0);
      L.add(l);
      P(l, sph(0.22), WHITE, [0, -0.12, 0], [1, 1.25, 1]);
      P(l, sph(0.25), PINK, [0, -0.38, 0.07], [1.05, 0.68, 1.25]);
      this.legs.push(l);
    }
    P(L, new THREE.BoxGeometry(0.72, 0.82, 0.36), VIO, [0, 0.16, -0.6], null, 1.07);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
    const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });
    for (const s of [-1, 1]) {
      P(L, new THREE.CylinderGeometry(0.16, 0.16, 0.78, 14), YEL, [s * 0.25, 0.12, -0.84], null, 1.1);
      P(L, new THREE.CylinderGeometry(0.12, 0.17, 0.14, 12), INK, [s * 0.25, -0.33, -0.84], null, 0);
      for (const [geo, mat] of [
        [cone(0.15, 0.7, 10), flameMat],
        [cone(0.08, 0.45, 8), flameCore],
      ] as const) {
        const f = new THREE.Mesh(geo, mat);
        f.position.set(s * 0.25, -0.4, -0.84);
        L.add(f);
        this.flames.push(f);
      }
    }
    const puffGeo = sph(0.16, 8, 6);
    for (let i = 0; i < PUFFS; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true }));
      m.visible = false;
      scene.add(m);
      this.puffs.push({ m, life: 0 });
    }
  }

  /** speedRatio: 0 ~ 1 (최고 속도 대비) */
  animate(dt: number, t: number, velocity: THREE.Vector3, speedRatio: number, reducedMotion: boolean): void {
    const k = Math.min(speedRatio, 1);
    if (velocity.length() > 0.5) {
      let dy = Math.atan2(velocity.x, velocity.z) - this.yaw.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw.rotation.y += dy * (1 - Math.exp(-8 * dt));
    }
    this.lean.rotation.x += (k * 0.55 - this.lean.rotation.x) * (1 - Math.exp(-6 * dt));
    if (reducedMotion) return;
    this.lean.position.y = Math.sin(t * 2.2) * 0.14 * (1 - k * 0.6);
    this.lean.rotation.z = Math.sin(t * 1.3) * 0.05;
    this.arms[0].rotation.set(-Math.sin(t * 2.2) * 0.25 - k * 0.9, 0, -0.25 - k * 0.3);
    this.arms[1].rotation.set(Math.sin(t * 2.2) * 0.25 - k * 0.9, 0, 0.25 + k * 0.3);
    this.legs[0].rotation.x = Math.sin(t * 2.6) * 0.25 + k * 0.5;
    this.legs[1].rotation.x = -Math.sin(t * 2.6) * 0.25 + k * 0.5;
    this.antBall.position.x = 0.4 + Math.sin(t * 5) * 0.04 * (1 + k * 3);
    const blink = t % 3.4 < 0.12;
    for (const e of this.eyes) e.scale.y = blink ? 0.25 : 1.7;
    this.flames.forEach((f, i) => f.scale.set(1, 0.35 + k * 1.6 + Math.sin(t * 40 + i) * 0.12, 1));
    if (k > 0.25 && Math.random() < k * 0.9) {
      const p = this.puffs[this.puffIdx++ % PUFFS];
      p.life = 1;
      p.m.visible = true;
      this.flames[Math.random() < 0.5 ? 0 : 2].getWorldPosition(p.m.position);
      p.m.position.add(this.tmp.set(Math.random() * 0.2 - 0.1, -0.3, Math.random() * 0.2 - 0.1));
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 1.8;
      (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(p.life, 0);
      p.m.scale.setScalar(0.6 + (1 - p.life) * 1.4);
      if (p.life <= 0) p.m.visible = false;
    }
  }
}

function cone(r: number, h: number, seg: number): THREE.ConeGeometry {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.rotateX(Math.PI);
  g.translate(0, -h / 2, 0);
  return g;
}
