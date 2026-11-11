import { useEffect, useRef } from "react";
import { UniverseScene } from "./Scene.ts";
import { sceneState } from "./sceneState.ts";
import { webglSupported } from "./webglSupport.ts";

/** 3D 우주를 React 화면에 붙이는 껍데기. WebGL 이 없으면 아무것도 그리지 않는다 (POLICY 3-1) */
export function UniverseCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ok = webglSupported();
    sceneState.setState({ webgl: ok });
    if (!ok || !ref.current) return;
    const scene = new UniverseScene(ref.current);
    return () => scene.dispose();
  }, []);
  return <div ref={ref} className="universe" />;
}
