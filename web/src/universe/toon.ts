// 만화풍 재질과 잉크 외곽선 (3D 시안의 표현 방식). 장면 하나가 만들고 dispose 한다.
import * as THREE from "three";

/** CSS 변수 값을 Three.js 색으로. 토큰이 없으면 fallback */
export function cssColor(name: string, fallback = "#ffffff"): THREE.Color {
  const v = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return new THREE.Color(v || fallback);
}

export class Toon {
  readonly ink: THREE.Color;
  readonly outline: THREE.MeshBasicMaterial;
  private readonly gradient: THREE.Texture;
  private readonly cache = new Map<string, THREE.MeshToonMaterial>();

  constructor() {
    this.ink = cssColor("ink", "#1a1430");
    this.outline = new THREE.MeshBasicMaterial({ color: this.ink, side: THREE.BackSide });
    // 3단계 명암
    const c = document.createElement("canvas");
    c.width = 3;
    c.height = 1;
    const g = c.getContext("2d")!;
    ["#5a5a5a", "#b0b0b0", "#ffffff"].forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(i, 0, 1, 1);
    });
    const t = new THREE.CanvasTexture(c);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    this.gradient = t;
  }

  /** 같은 색·옵션이면 재질을 다시 쓴다 */
  mat(color: THREE.ColorRepresentation, opts: { emissive?: THREE.ColorRepresentation } = {}): THREE.MeshToonMaterial {
    const key = `${new THREE.Color(color).getHexString()}|${opts.emissive ?? ""}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, emissive: opts.emissive ?? 0x000000 });
      this.cache.set(key, m);
    }
    return m;
  }

  /** 뒷면을 조금 키운 잉크색 복제로 외곽선을 만든다 */
  outlined<T extends THREE.Mesh>(mesh: T, scale = 1.08): T {
    if (scale > 0) {
      const o = new THREE.Mesh(mesh.geometry, this.outline);
      o.scale.setScalar(scale);
      o.raycast = () => {}; // 외곽선은 클릭 대상이 아니다
      mesh.add(o);
    }
    return mesh;
  }

  part(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    pos?: [number, number, number],
    scale?: [number, number, number] | null,
    outline = 1.08,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color));
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    this.outlined(m, outline);
    parent.add(m);
    return m;
  }

  dispose(): void {
    this.outline.dispose();
    this.gradient.dispose();
    this.cache.forEach((m) => m.dispose());
  }
}

/** 장면 아래 모든 geometry·material·texture 해제 (React 가 대신 해 주지 않는다) */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}
