// 노션과 같은 단축키를 BlockNote 위에 덧씌우는 확장
// - Ctrl/Cmd+Shift+0~8, Cmd+Option+0~8: 블록 종류 바꾸기 (노션 순서)
// - Ctrl/Cmd+D 블록 복제, Ctrl/Cmd+K 링크, Ctrl/Cmd+Shift+H 형광펜, Ctrl/Cmd+Enter 할 일 체크
// - "> " 토글 목록 (노션 방식, 인용은 '" ')
import { createExtension } from "@blocknote/core";

// 노션 번호 순서: 0 텍스트, 1~3 제목, 4 할 일, 5 글머리 기호, 6 번호, 7 토글, 8 코드
const TURN_INTO = [
  { type: "paragraph" },
  { type: "heading", props: { level: 1 } },
  { type: "heading", props: { level: 2 } },
  { type: "heading", props: { level: 3 } },
  { type: "checkListItem" },
  { type: "bulletListItem" },
  { type: "numberedListItem" },
  { type: "toggleListItem" },
  { type: "codeBlock" },
];

export const SHORTCUT_HELP = [
  ["Ctrl+Shift+0", "텍스트"],
  ["Ctrl+Shift+1 / 2 / 3", "제목 1 / 2 / 3"],
  ["Ctrl+Shift+4", "할 일 목록"],
  ["Ctrl+Shift+5", "글머리 기호 목록"],
  ["Ctrl+Shift+6", "번호 목록"],
  ["Ctrl+Shift+7", "토글 목록"],
  ["Ctrl+Shift+8", "코드 블록"],
  ["Ctrl+B / I / U", "굵게 / 기울임 / 밑줄"],
  ["Ctrl+Shift+S", "취소선"],
  ["Ctrl+E", "인라인 코드"],
  ["Ctrl+K", "링크"],
  ["Ctrl+Shift+H", "형광펜"],
  ["Ctrl+D", "블록 복제"],
  ["Ctrl+Shift+↑ / ↓", "블록 위·아래로 이동"],
  ["Tab / Shift+Tab", "들여쓰기 / 내어쓰기"],
  ["Ctrl+Enter", "할 일 체크"],
  ["Ctrl+Z / Ctrl+Shift+Z", "실행 취소 / 다시 실행"],
  ["/", "블록 메뉴"],
  ["# ## ###", "제목"],
  ["- 또는 *", "글머리 기호"],
  ["1.", "번호 목록"],
  ["[]", "할 일"],
  [">", "토글 목록"],
  ['"', "인용"],
  ["```", "코드 블록"],
  ["---", "구분선"],
  ["`코드`", "인라인 코드"],
];

function turnInto(editor, target) {
  const block = editor.getTextCursorPosition().block;
  // 글자가 들어가는 블록(일반 inline, 코드 블록 plain)만 종류를 바꿀 수 있음
  if (!["inline", "plain"].includes(editor.schema.blockSchema[block.type]?.content)) return false;
  if (!editor.schema.blockSchema[target.type]) return false;
  editor.updateBlock(block, { type: target.type, props: target.props || {} });
  return true;
}

// 복제할 때 id가 겹치지 않도록 하위 블록까지 id 제거
function withoutIds(block) {
  const { id, children, ...rest } = block;
  return { ...rest, children: (children || []).map(withoutIds) };
}

const shortcuts = {};
TURN_INTO.forEach((target, n) => {
  const run = ({ editor }) => turnInto(editor, target);
  shortcuts[`Mod-Shift-${n}`] = run; // Windows 노션
  shortcuts[`Mod-Alt-${n}`] = run; // Mac 노션 (Cmd+Option)
});

Object.assign(shortcuts, {
  "Mod-d": ({ editor }) => {
    const block = editor.getTextCursorPosition().block;
    editor.insertBlocks([withoutIds(block)], block, "after");
    return true;
  },
  "Mod-k": ({ editor }) => {
    const current = editor.getSelectedLinkUrl?.() || "";
    const url = window.prompt("링크 주소", current || "https://");
    if (!url || url === "https://") return true;
    const text = editor.getSelectedText();
    editor.createLink(url, text ? undefined : url);
    return true;
  },
  "Mod-Shift-h": ({ editor }) => {
    editor.toggleStyles({ backgroundColor: "yellow" });
    return true;
  },
  "Mod-Enter": ({ editor }) => {
    const block = editor.getTextCursorPosition().block;
    if (block.type !== "checkListItem") return false;
    editor.updateBlock(block, { props: { checked: !block.props.checked } });
    return true;
  },
});

export const notionShortcuts = createExtension({
  key: "notion-shortcuts",
  // 기본 블록 단축키보다 먼저 실행돼야 노션 쪽 동작이 우선함
  runsBefore: [
    "paragraph-shortcuts",
    "heading-shortcuts",
    "bullet-list-item-shortcuts",
    "numbered-list-item-shortcuts",
    "check-list-item-shortcuts",
    "toggle-list-item-shortcuts",
    "quote-block-shortcuts",
  ],
  keyboardShortcuts: shortcuts,
  inputRules: [
    {
      find: /^>\s$/,
      replace() {
        return { type: "toggleListItem", props: {} };
      },
    },
  ],
});
