// Jekyll 글(front matter + 마크다운) 파싱·직렬화와 파일 경로 규칙
import yaml from "js-yaml";

// CORE_SCHEMA: 날짜를 Date 객체로 바꾸지 않고 문자열 그대로 유지
// json: true: 기존 글에 있는 중복 키(categories: 두 번)를 오류 없이 마지막 값으로 처리
const YAML_OPTS = { schema: yaml.CORE_SCHEMA, json: true };

export function parsePost(text) {
  // Windows에서 쓴 글(CRLF)은 목록 등이 문단으로 읽히므로 줄바꿈을 LF로 통일
  text = text.replace(/\r\n?/g, "\n");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: yaml.load(m[1], YAML_OPTS) || {}, body: m[2].replace(/^\s*\n/, "") };
}

export function serializePost(fm, body) {
  const head = yaml.dump(fm, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true });
  return `---\n${head}---\n\n${body.trim()}\n`;
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 한글은 유지하고 공백·특수문자만 정리
export function slugify(title) {
  return (title || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// 기존 글의 태그는 [[a, b]] 처럼 중첩된 경우가 있어 평탄화
export function toList(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flat(Infinity).map(String).filter(Boolean);
  return String(v).split(/[,\s]+/).filter(Boolean);
}

// "C/Rust" → "CRust" (폴더·주소에 쓸 수 없는 문자 제거)
export function categoryKey(category) {
  return (category || "").replace(/[^\p{L}\p{N}_-]/gu, "");
}

export function postPath(meta) {
  const key = categoryKey(meta.category);
  const folder = key ? `${key}/` : "";
  return `_posts/${folder}${meta.date}-${meta.slug}.md`;
}

// _posts/Cloud/2023-03-13-cloud-kubernetes-intro.md → { date, slug, folder }
export function splitPath(path) {
  const rel = path.replace(/^_posts\//, "");
  const parts = rel.split("/");
  const file = parts.pop().replace(/\.(md|markdown)$/i, "");
  const m = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return { folder: parts.join("/"), date: m ? m[1] : "", slug: m ? m[2] : file };
}

export function metaFromPost(path, fm) {
  const { folder, date, slug } = splitPath(path);
  const cats = toList(fm.categories ?? fm.category);
  return {
    title: fm.title || "",
    excerpt: fm.excerpt || "",
    category: cats[0] || folder || "",
    tags: toList(fm.tags).join(", "),
    date: String(fm.date || date || today()).slice(0, 10),
    slug,
    toc: fm.toc !== false && fm.toc != null ? true : false,
    permalink: fm.permalink || "",
  };
}

export function emptyMeta(defaultCategory) {
  return {
    title: "",
    excerpt: "",
    category: defaultCategory || "",
    tags: "",
    date: today(),
    slug: "",
    toc: true,
    permalink: "",
  };
}

// 원래 front matter를 보존하면서 에디터에서 다루는 필드만 덮어씀
export function buildFrontMatter(original, meta) {
  const fm = { ...original };
  delete fm.category;
  fm.title = meta.title;
  if (meta.excerpt) fm.excerpt = meta.excerpt;
  else delete fm.excerpt;
  if (meta.category) fm.categories = [meta.category];
  else delete fm.categories;
  fm.tags = toList(meta.tags);
  fm.permalink = meta.permalink || `/${(categoryKey(meta.category) || "notes").toLowerCase()}/${meta.slug}/`;
  fm.toc = !!meta.toc;
  if (meta.toc) fm.toc_sticky = true;
  else delete fm.toc_sticky;
  fm.date = original.date && String(original.date).slice(0, 10) === meta.date ? original.date : meta.date;
  fm.last_modified_at = today();
  return fm;
}

// 에디터에서 붙여넣은 이미지는 data URL로 들고 있다가, 발행할 때 파일로 떼어내 저장소에 함께 커밋
// 캡션 없는 이미지는 ![](data:…), 캡션 있는 이미지는 <figure><img src="data:…"> 로 나오므로 둘 다 처리
export function extractInlineImages(markdown, folder, baseurl) {
  const files = [];
  let n = 0;
  const out = markdown.replace(
    /data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi,
    (_, type, b64) => {
      n += 1;
      const ext = { jpeg: "jpg", "svg+xml": "svg" }[type.toLowerCase()] || type.toLowerCase();
      const name = `${Date.now().toString(36)}-${n}.${ext}`;
      const path = `assets/images/posts/${folder}/${name}`;
      files.push({ path, base64: b64 });
      return `${baseurl}/${path}`;
    }
  );
  return { markdown: out, files };
}

// 큰 사진은 가로 1600px로 줄여서 저장소가 무거워지지 않게 함
export async function fileToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return raw;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = raw;
  });
  const MAX = 1600;
  if (img.width <= MAX) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = MAX;
  canvas.height = Math.round((img.height * MAX) / img.width);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.88);
}
