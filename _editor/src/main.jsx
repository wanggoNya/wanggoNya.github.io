import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { ko } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./editor.css";

import { GitHub, utf8ToBase64 } from "./github.js";
import {
  buildFrontMatter,
  emptyMeta,
  extractInlineImages,
  fileToDataUrl,
  metaFromPost,
  parsePost,
  postPath,
  serializePost,
  slugify,
  splitPath,
} from "./post.js";

const CONFIG = window.BLOG_EDITOR_CONFIG || {};
const TOKEN_KEY = "blogEditor.token";
const DRAFT_PREFIX = "blogEditor.draft:";

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

function SettingsModal({ initialToken, onSave, onClose, canClose }) {
  const [token, setToken] = useState(initialToken || "");
  const [state, setState] = useState({ busy: false, msg: "" });

  const save = async () => {
    setState({ busy: true, msg: "확인 중…" });
    try {
      const info = await new GitHub(token.trim(), CONFIG.repo).repoInfo();
      if (!info.permissions?.push) throw new Error("이 토큰에는 저장소 쓰기 권한이 없어요 (Contents: Read and write 필요).");
      store.set(TOKEN_KEY, token.trim());
      onSave(token.trim());
    } catch (e) {
      setState({ busy: false, msg: e.message });
    }
  };

  return (
    <div className="ge-modal-backdrop" onClick={canClose ? onClose : undefined}>
      <div className="ge-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🍊 에디터 연결</h2>
        <p>
          글을 저장하려면 <b>{CONFIG.repo}</b> 저장소에 쓸 수 있는 GitHub 토큰이 필요해요. 토큰은 이 브라우저에만 저장돼요.
        </p>
        <ol>
          <li>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              Fine-grained 토큰 만들기
            </a>
          </li>
          <li>Repository access → <b>Only select repositories</b> → {CONFIG.repo}</li>
          <li>Permissions → <b>Contents: Read and write</b> (Metadata는 자동)</li>
        </ol>
        <input
          type="password"
          placeholder="github_pat_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          autoFocus
        />
        {state.msg && <p className="ge-modal-msg">{state.msg}</p>}
        <div className="ge-modal-actions">
          {initialToken && (
            <button
              className="ge-btn ge-btn--ghost"
              onClick={() => {
                store.del(TOKEN_KEY);
                onSave("");
              }}
            >
              연결 해제
            </button>
          )}
          {canClose && (
            <button className="ge-btn ge-btn--ghost" onClick={onClose}>
              닫기
            </button>
          )}
          <button className="ge-btn ge-btn--primary" disabled={!token.trim() || state.busy} onClick={save}>
            연결하기
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ posts, currentPath, onOpen, onNew, open, onClose }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = {};
    for (const p of posts) {
      if (q && !p.path.toLowerCase().includes(q.toLowerCase())) continue;
      const { folder } = splitPath(p.path);
      (g[folder || "기타"] ||= []).push(p);
    }
    for (const k in g) g[k].sort((a, b) => b.path.localeCompare(a.path));
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [posts, q]);

  return (
    <aside className={`ge-sidebar ${open ? "is-open" : ""}`}>
      <div className="ge-sidebar__head">
        <a className="ge-brand" href={CONFIG.baseurl + "/"}>
          <span className="ge-brand__fruit">🍊</span> {CONFIG.title}
        </a>
        <button className="ge-icon-btn ge-only-mobile" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      <button className="ge-new" onClick={onNew}>
        ＋ 새 글
      </button>
      <input className="ge-search" placeholder="글 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      <nav className="ge-tree">
        {groups.map(([folder, items]) => (
          <details key={folder} open>
            <summary>{folder}</summary>
            {items.map((p) => {
              const { date, slug } = splitPath(p.path);
              return (
                <button
                  key={p.path}
                  className={`ge-tree__item ${p.path === currentPath ? "is-active" : ""}`}
                  onClick={() => onOpen(p.path)}
                  title={p.path}
                >
                  <span className="ge-tree__date">{date.slice(2)}</span> {decodeURIComponent(slug)}
                </button>
              );
            })}
          </details>
        ))}
        {!posts.length && <p className="ge-muted">글이 아직 없어요.</p>}
      </nav>
    </aside>
  );
}

function Prop({ label, children }) {
  return (
    <div className="ge-prop">
      <span className="ge-prop__label">{label}</span>
      <div className="ge-prop__value">{children}</div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => store.get(TOKEN_KEY) || "");
  const [showSettings, setShowSettings] = useState(!store.get(TOKEN_KEY));
  const [branch, setBranch] = useState(CONFIG.branch || "");
  const [posts, setPosts] = useState([]);
  const [doc, setDoc] = useState({ path: null, fm: {}, sha: null }); // 현재 편집 중인 원본
  const [meta, setMeta] = useState(() => emptyMeta(CONFIG.categories?.[0]));
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [dirty, setDirty] = useState(false);
  const [rev, setRev] = useState(0); // 본문이 바뀔 때마다 증가 → 임시저장 타이머 재시작
  const [draftOffer, setDraftOffer] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loadingRef = useRef(false);
  const titleRef = useRef(null);

  // 제목이 길어지면 줄 수에 맞춰 높이를 늘림
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [meta.title]);

  const gh = useMemo(() => (token ? new GitHub(token, CONFIG.repo) : null), [token]);

  const editor = useCreateBlockNote({
    dictionary: ko,
    uploadFile: async (file) => fileToDataUrl(file),
  });

  const draftKey = (path) => DRAFT_PREFIX + (path || "new");

  const refreshPosts = useCallback(
    async (br = branch) => {
      if (!gh || !br) return;
      setPosts(await gh.listPosts(br));
    },
    [gh, branch]
  );

  // 연결되면 기본 브랜치와 글 목록을 가져옴
  useEffect(() => {
    if (!gh) return;
    (async () => {
      try {
        let br = branch;
        if (!br) {
          br = (await gh.repoInfo()).default_branch;
          setBranch(br);
        }
        await refreshPosts(br);
        const want = new URLSearchParams(location.search).get("path");
        if (want) await openPost(want, br);
        else checkDraft(null);
      } catch (e) {
        setStatus({ kind: "error", text: e.message });
        if (e.status === 401) setShowSettings(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh]);

  // 편집 내용이 바뀌면 브라우저에 임시저장
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      const ok = store.set(
        draftKey(doc.path),
        JSON.stringify({ meta, blocks: editor.document, savedAt: Date.now() })
      );
      setStatus(ok ? { kind: "idle", text: "임시저장됨" } : { kind: "warn", text: "임시저장 공간이 부족해요" });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, meta, doc.path, rev]);

  const markDirty = () => {
    if (loadingRef.current) return;
    setDirty(true);
    setRev((r) => r + 1);
  };

  const setDocBlocks = (blocks) => {
    loadingRef.current = true;
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph" }]);
    setTimeout(() => (loadingRef.current = false), 0);
  };

  function checkDraft(path) {
    const raw = store.get(draftKey(path));
    if (!raw) return setDraftOffer(null);
    try {
      setDraftOffer(JSON.parse(raw));
    } catch {
      setDraftOffer(null);
    }
  }

  const confirmLeave = () => !dirty || confirm("임시저장만 된 변경 사항이 있어요. 다른 글로 이동할까요?\n(임시저장본은 나중에 다시 불러올 수 있어요)");

  async function openPost(path, br = branch) {
    if (!confirmLeave()) return;
    setSidebarOpen(false);
    setStatus({ kind: "busy", text: "불러오는 중…" });
    try {
      const list = posts.length ? posts : await gh.listPosts(br);
      const entry = list.find((p) => p.path === path);
      if (!entry) throw new Error(`글을 찾을 수 없어요: ${path}`);
      const { fm, body } = parsePost(await gh.readBlob(entry.sha));
      setDoc({ path, fm, sha: entry.sha });
      setMeta(metaFromPost(path, fm));
      setSlugTouched(true);
      setDocBlocks(editor.tryParseMarkdownToBlocks(body));
      setDirty(false);
      history.replaceState(null, "", `?path=${encodeURIComponent(path)}`);
      setStatus({ kind: "idle", text: "" });
      checkDraft(path);
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  function newPost() {
    if (!confirmLeave()) return;
    setSidebarOpen(false);
    setDoc({ path: null, fm: {}, sha: null });
    setMeta(emptyMeta(CONFIG.categories?.[0]));
    setSlugTouched(false);
    setDocBlocks([]);
    setDirty(false);
    history.replaceState(null, "", location.pathname);
    setStatus({ kind: "idle", text: "" });
    checkDraft(null);
  }

  function restoreDraft() {
    setMeta(draftOffer.meta);
    setSlugTouched(true);
    setDocBlocks(draftOffer.blocks);
    setDraftOffer(null);
    setDirty(true);
  }

  const update = (patch) => {
    setMeta((m) => {
      const next = { ...m, ...patch };
      if ("title" in patch && !slugTouched && !doc.path) next.slug = slugify(patch.title);
      return next;
    });
    markDirty();
  };

  async function publish() {
    if (!meta.title.trim()) return setStatus({ kind: "error", text: "제목을 입력해 주세요." });
    const slug = meta.slug.trim().replace(/[\s/\\?#%]+/g, "-").replace(/^-+|-+$/g, "") || slugify(meta.title);
    if (!slug) return setStatus({ kind: "error", text: "파일 이름(slug)을 입력해 주세요." });
    const m = { ...meta, slug };
    const path = postPath(m);
    if (path !== doc.path && posts.some((p) => p.path === path))
      return setStatus({ kind: "error", text: `같은 파일이 이미 있어요: ${path}` });

    setStatus({ kind: "busy", text: "발행 중…" });
    try {
      const raw = editor.blocksToMarkdownLossy(editor.document);
      const { markdown, files } = extractInlineImages(raw, `${m.date}-${slug}`, CONFIG.baseurl);
      const fm = buildFrontMatter(doc.fm, m);
      const changes = [
        ...files,
        { path, base64: utf8ToBase64(serializePost(fm, markdown)) },
      ];
      if (doc.path && doc.path !== path) changes.push({ path: doc.path, delete: true });
      const verb = doc.path ? "Update" : "Add";
      await gh.commit(branch, changes, `${verb} post: ${m.title}`);

      store.del(draftKey(doc.path));
      store.del(draftKey(path));
      setDoc({ path, fm, sha: null });
      setMeta(m);
      setDirty(false);
      setDraftOffer(null);
      history.replaceState(null, "", `?path=${encodeURIComponent(path)}`);
      // 이미지가 data URL에서 저장소 경로로 바뀌었으니 에디터도 새 마크다운으로 다시 맞춤
      if (files.length) setDocBlocks(editor.tryParseMarkdownToBlocks(markdown));
      await refreshPosts();
      setStatus({
        kind: "ok",
        text: "발행 완료! 1~2분 뒤 블로그에 반영돼요.",
        link: CONFIG.baseurl + fm.permalink,
      });
    } catch (e) {
      setStatus({ kind: "error", text: `발행 실패 — ${e.message}` });
    }
  }

  async function removePost() {
    if (!doc.path) return;
    if (!confirm(`'${meta.title}' 글을 삭제할까요?\n저장소 커밋 기록에는 남아서 나중에 되살릴 수 있어요.`)) return;
    setStatus({ kind: "busy", text: "삭제 중…" });
    try {
      await gh.commit(branch, [{ path: doc.path, delete: true }], `Delete post: ${meta.title}`);
      store.del(draftKey(doc.path));
      await refreshPosts();
      setDirty(false);
      newPost();
      setStatus({ kind: "ok", text: "삭제했어요." });
    } catch (e) {
      setStatus({ kind: "error", text: `삭제 실패 — ${e.message}` });
    }
  }

  // Ctrl/Cmd+S 로 발행
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (gh) publish();
      }
    };
    const onUnload = (e) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  });

  const categories = useMemo(() => {
    const set = new Set(CONFIG.categories || []);
    if (meta.category) set.add(meta.category);
    return [...set];
  }, [meta.category]);

  return (
    <div className="ge-app">
      <Sidebar
        posts={posts}
        currentPath={doc.path}
        onOpen={(p) => openPost(p)}
        onNew={newPost}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="ge-main">
        <header className="ge-topbar">
          <button className="ge-icon-btn ge-only-mobile" onClick={() => setSidebarOpen(true)} aria-label="글 목록">
            ☰
          </button>
          <span className="ge-crumb">{doc.path ? doc.path.replace(/^_posts\//, "") : "새 글"}</span>
          <span className={`ge-status ge-status--${status.kind}`}>
            {status.text}
            {status.link && (
              <>
                {" "}
                <a href={status.link} target="_blank" rel="noreferrer">
                  글 보기 ↗
                </a>
              </>
            )}
          </span>
          <div className="ge-actions">
            {doc.path && (
              <button className="ge-btn ge-btn--ghost" onClick={removePost} disabled={!gh}>
                삭제
              </button>
            )}
            <button className="ge-btn ge-btn--ghost" onClick={() => setShowSettings(true)} aria-label="설정">
              ⚙
            </button>
            <button
              className="ge-btn ge-btn--primary"
              onClick={publish}
              disabled={!gh || status.kind === "busy"}
              title="Ctrl+S"
            >
              발행하기
            </button>
          </div>
        </header>

        <div className="ge-page">
          {draftOffer && (
            <div className="ge-banner">
              <span>
                {new Date(draftOffer.savedAt).toLocaleString("ko-KR")}에 임시저장된 내용이 있어요.
              </span>
              <button className="ge-btn ge-btn--lime" onClick={restoreDraft}>
                불러오기
              </button>
              <button
                className="ge-btn ge-btn--ghost"
                onClick={() => {
                  store.del(draftKey(doc.path));
                  setDraftOffer(null);
                }}
              >
                버리기
              </button>
            </div>
          )}

          <textarea
            className="ge-title"
            rows={1}
            placeholder="제목 없음"
            value={meta.title}
            ref={titleRef}
            onChange={(e) => update({ title: e.target.value })}
          />

          <div className="ge-props">
            <Prop label="카테고리">
              <select value={meta.category} onChange={(e) => update({ category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Prop>
            <Prop label="태그">
              <input
                placeholder="쉼표로 구분 — study, cloud"
                value={meta.tags}
                onChange={(e) => update({ tags: e.target.value })}
              />
            </Prop>
            <Prop label="날짜">
              <input type="date" value={meta.date} onChange={(e) => update({ date: e.target.value })} />
            </Prop>
            <Prop label="요약">
              <input
                placeholder="목록에 보일 한 줄 소개"
                value={meta.excerpt}
                onChange={(e) => update({ excerpt: e.target.value })}
              />
            </Prop>
            <Prop label="목차">
              <label className="ge-check">
                <input type="checkbox" checked={meta.toc} onChange={(e) => update({ toc: e.target.checked })} />
                오른쪽에 목차 표시
              </label>
            </Prop>
            <Prop label="주소">
              <input
                placeholder="파일·주소에 쓸 이름"
                value={meta.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update({ slug: e.target.value.replace(/\s+/g, "-") });
                }}
              />
            </Prop>
          </div>

          <div className="ge-editor">
            <BlockNoteView editor={editor} theme="light" onChange={markDirty} />
          </div>
          <p className="ge-hint">
            <kbd>/</kbd> 블록 메뉴 · 이미지는 붙여넣기·드래그 · <kbd>Ctrl</kbd>+<kbd>S</kbd> 발행
          </p>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          initialToken={token}
          canClose={!!token}
          onClose={() => setShowSettings(false)}
          onSave={(t) => {
            setToken(t);
            setShowSettings(!t);
          }}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById("blog-editor")).render(<App />);
