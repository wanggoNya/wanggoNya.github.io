// GitHub REST API 얇은 래퍼 — 글·이미지를 한 번의 커밋으로 저장소에 올림
const API = "https://api.github.com";

export function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

export function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHub {
  constructor(token, repo) {
    this.token = token;
    this.repo = repo;
  }

  async req(path, { method = "GET", body } = {}) {
    const res = await fetch(`${API}/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = (await res.json()).message || msg;
      } catch {}
      const err = new Error(`GitHub ${res.status}: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  repoInfo() {
    return this.req("");
  }

  // _posts 아래 모든 마크다운 파일 (path, sha)
  async listPosts(branch) {
    const tree = await this.req(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return tree.tree
      .filter((t) => t.type === "blob" && t.path.startsWith("_posts/") && /\.(md|markdown)$/i.test(t.path))
      .map((t) => ({ path: t.path, sha: t.sha }));
  }

  async readBlob(sha) {
    const blob = await this.req(`/git/blobs/${sha}`);
    return base64ToUtf8(blob.content);
  }

  /**
   * 여러 파일 변경을 커밋 하나로 묶어 브랜치에 반영.
   * changes: [{ path, base64 }] 또는 [{ path, delete: true }]
   */
  async commit(branch, changes, message) {
    const ref = await this.req(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = ref.object.sha;
    const head = await this.req(`/git/commits/${headSha}`);

    const tree = [];
    for (const c of changes) {
      if (c.delete) {
        tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
      } else {
        const blob = await this.req("/git/blobs", {
          method: "POST",
          body: { content: c.base64, encoding: "base64" },
        });
        tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
      }
    }

    const newTree = await this.req("/git/trees", {
      method: "POST",
      body: { base_tree: head.tree.sha, tree },
    });
    const newCommit = await this.req("/git/commits", {
      method: "POST",
      body: { message, tree: newTree.sha, parents: [headSha] },
    });
    await this.req(`/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: { sha: newCommit.sha },
    });
    return newCommit;
  }
}
