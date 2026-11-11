// 단축키 표시 이름 (Electron 없이 테스트하려고 분리)
/** 메뉴·안내에 보일 이름. 예 "Ctrl+Shift+Space", 맥 "⌘⇧Space" */
export function shortcutLabel(accelerator: string, platform = process.platform): string {
  if (platform === "darwin") {
    return accelerator
      .replace(/CommandOrControl\+|CmdOrCtrl\+|Command\+|Cmd\+/g, "⌘")
      .replace(/Shift\+/g, "⇧")
      .replace(/Alt\+|Option\+/g, "⌥")
      .replace(/Control\+|Ctrl\+/g, "⌃");
  }
  return accelerator.replace(/CommandOrControl|CmdOrCtrl/g, "Ctrl");
}
