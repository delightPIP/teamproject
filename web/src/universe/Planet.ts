// 행성 하나 (3D 시안의 만화풍 행성). 크기는 기간 안 별 개수로 정하고(POLICY 2-5) 바뀔 때 서서히 커지고 줄어든다.
import * as THREE from "three";
import type { Planet } from "@spacelog/shared/types";
import { seeded, type Vec3 } from "./layout.ts";
import { planetColorToken } from "../ui/planetColor.ts";
import { cssColor, type Toon } from "./toon.ts";

/** 모형을 이 반지름으로 만들고 spin 그룹 크기로 실제 반지름을 맞춘다 */
const MODEL_R = 5;
/** 행성 크기 전환 속도. 약 400ms 안에 거의 도착 (SPEC 3-4) */
const SCALE_RATE = 10;

type Deco = "town" | "crystal" | "forest" | "rock";
const DECOS: Deco[] = ["town", "crystal", "forest", "rock"];

export class PlanetView {
  readonly id: string;
  readonly group = new THREE.Group();
  readonly body: THREE.Mesh;
  private readonly spin = new THREE.Group();
  private readonly ring: THREE.Mesh | null = null;
  private readonly label: THREE.Sprite;
  private readonly labelCanvas = document.createElement("canvas");
  private name = "";
  private count = -1;
  private targetR = 0;
  /** 지금 화면에 그려진 반지름 */
  radius = 0;

  constructor(planet: Planet, pos: Vec3, toon: Toon) {
    this.id = planet.id;
    this.group.position.set(...pos);
    this.group.add(this.spin);
    this.spin.scale.setScalar(0);
    const rnd = seeded(planet.id);
    const color = cssColor(planetColorToken(planet.colorToken), "#c29bff");
    const dark = color.clone().multiplyScalar(0.72);
    const light = color.clone().lerp(new THREE.Color(0xffffff), 0.45);

    // 각진 로우폴리 면 (DESIGN 2장 · 8장): 꼭짓점을 나눠 면마다 법선을 따로 둔다
    const bodyGeo = new THREE.IcosahedronGeometry(MODEL_R, 2).toNonIndexed();
    bodyGeo.computeVertexNormals();
    this.body = toon.outlined(new THREE.Mesh(bodyGeo, toon.mat(color)), 1.035);
    this.body.userData.planetId = planet.id;
    this.spin.add(this.body);

    // 표면 장식: 행성 id 시드로 마을·수정·숲·바위 중 하나
    const deco = DECOS[Math.floor(rnd() * DECOS.length)];
    const up = new THREE.Vector3(0, 1, 0);
    const place = (m: THREE.Object3D, dir: THREE.Vector3, h: number) => {
      m.position.copy(dir).multiplyScalar(MODEL_R + h);
      m.quaternion.setFromUnitVectors(up, dir);
      this.spin.add(m);
    };
    const n = { town: 16, crystal: 14, forest: 18, rock: 12 }[deco];
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      if (dir.y > 0.9) continue; // 깃발 자리
      if (deco === "town") {
        const m =
          i % 3
            ? new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8 + rnd(), 0.9), toon.mat(i % 2 ? 0xfff3d6 : light))
            : new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), toon.mat(dark));
        place(toon.outlined(m, 1.12), dir, 0.3);
      } else if (deco === "crystal") {
        const m = toon.outlined(new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), toon.mat(i % 2 ? 0xffffff : light)), 1.14);
        m.scale.set(0.7, 1.6 + rnd(), 0.7);
        place(m, dir, 0.6);
      } else if (deco === "forest") {
        const tree = new THREE.Group();
        const trunk = toon.outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 6), toon.mat(0x8a5a3c)), 1.2);
        trunk.position.y = 0.35;
        const top = toon.outlined(new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), toon.mat(i % 3 ? dark : 0xd6ff8a)), 1.12);
        top.position.y = 1.05;
        tree.add(trunk, top);
        place(tree, dir, 0);
      } else {
        const m = toon.outlined(new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.4, 0), toon.mat(i % 2 ? dark : 0xffffff)), 1.12);
        place(m, dir, 0.1);
      }
    }
    toon.part(this.spin, new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), 0xffffff, [0, MODEL_R + 1.1, 0], null, 1.2);
    toon.part(this.spin, new THREE.BoxGeometry(1.3, 0.8, 0.06), cssColor("pink", "#ff5d8f"), [0.68, MODEL_R + 1.9, 0], null, 1.1);
    if (rnd() < 0.35) {
      const ring = toon.outlined(new THREE.Mesh(new THREE.TorusGeometry(MODEL_R * 1.65, 0.28, 6, 56), toon.mat(0xfff1a0)), 1.08);
      ring.scale.z = 0.35;
      ring.rotation.set(1.25, 0, 0.3);
      this.spin.add(ring);
      this.ring = ring;
    }

    this.labelCanvas.width = 768;
    this.labelCanvas.height = 200;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(this.labelCanvas), transparent: true, depthWrite: false }));
    this.label.scale.set(9, 2.35, 1);
    this.label.raycast = () => {};
    this.group.add(this.label);
    this.update(planet);
    this.setRadius(0); // 별 개수가 정해질 때까지 숨긴다
  }

  /** 이름·별 개수 반영. 개수가 0이면 사라진다 */
  update(planet: Planet): void {
    const n = planet.starCountInPeriod ?? 0;
    if (planet.name !== this.name || n !== this.count) {
      this.name = planet.name;
      this.count = n;
      this.drawLabel();
    }
  }

  setTargetRadius(r: number, immediate = false): void {
    this.targetR = r;
    if (immediate) this.setRadius(r);
  }

  /** 매 프레임: 자전, 크기 전환. 다 사라졌으면 숨긴다 */
  tick(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      this.spin.rotation.y += dt * 0.06;
      if (this.ring) this.ring.rotation.z += dt * 0.05;
    }
    if (this.radius !== this.targetR) {
      const next = this.radius + (this.targetR - this.radius) * Math.min(1, dt * SCALE_RATE);
      this.setRadius(Math.abs(next - this.targetR) < 0.01 ? this.targetR : next);
    }
  }

  get visible(): boolean {
    return this.group.visible;
  }

  /** 화면에 머무르는 동안 쓰는 위치 (자동 비행·착륙 거리 계산) */
  get position(): THREE.Vector3 {
    return this.group.position;
  }

  private setRadius(r: number): void {
    this.radius = r;
    this.spin.scale.setScalar(r / MODEL_R);
    this.label.position.y = r + 4.3;
    this.group.visible = r > 0.01;
  }

  private drawLabel(): void {
    const g = this.labelCanvas.getContext("2d")!;
    const ink = "#" + cssColor("ink", "#1a1430").getHexString();
    g.clearRect(0, 0, 768, 200);
    g.textAlign = "center";
    g.lineJoin = "round";
    g.font = `86px ${fontVar("font-display")}`;
    g.lineWidth = 18;
    g.strokeStyle = ink;
    g.strokeText(this.name, 384, 100);
    g.fillStyle = "#fff";
    g.fillText(this.name, 384, 100);
    g.font = `600 38px ${fontVar("font-body")}`;
    g.lineWidth = 12;
    g.strokeText(`별 ${this.count.toLocaleString("ko-KR")}개`, 384, 160);
    g.fillStyle = "#" + cssColor("yellow", "#ffd23f").getHexString();
    g.fillText(`별 ${this.count.toLocaleString("ko-KR")}개`, 384, 160);
    (this.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  /** 이 행성만의 geometry 와 라벨을 해제한다. 재질은 Toon 이 여러 행성과 나눠 쓰므로 두고 간다 */
  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    const label = this.label.material as THREE.SpriteMaterial;
    label.map?.dispose();
    label.dispose();
  }

  /** 글꼴이 늦게 로드되면 다시 그린다 */
  redrawLabel(): void {
    this.drawLabel();
  }
}

function fontVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || "sans-serif";
}
