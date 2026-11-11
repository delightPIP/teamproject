/** WebGL 을 쓸 수 있는지 (POLICY 3-1: 없으면 3D 대신 행성 목록과 패널만) */
export function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") ?? c.getContext("webgl")));
  } catch {
    return false;
  }
}
