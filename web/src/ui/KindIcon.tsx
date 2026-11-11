import type { StarKind } from "../types";

const ICON: Record<StarKind, { glyph: string; label: string }> = {
  image: { glyph: "🖼", label: "이미지" },
  file: { glyph: "📄", label: "파일" },
  link: { glyph: "🔗", label: "링크" },
  text: { glyph: "📝", label: "텍스트" },
};

/** shortcut: 이모지 임시 아이콘. 디자이너가 아이콘을 주면 바꾼다 */
export function KindIcon({ kind, size = 20 }: { kind: StarKind; size?: number }) {
  const { glyph, label } = ICON[kind];
  return (
    <span className={`kind-icon kind-icon--${kind}`} role="img" aria-label={label} style={{ fontSize: size }}>
      {glyph}
    </span>
  );
}
