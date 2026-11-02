"""
티스토리(wanggonya.tistory.com) 공개 글을 Jekyll 글(_posts)로 옮기는 스크립트.

- 글 목록: 티스토리 sitemap.xml 의 숫자 주소
- 날짜: 글 페이지 JSON-LD 의 datePublished / dateModified (시각·시간대 포함)
- 카테고리: "상위/하위" 중 상위를 categories, 하위를 tags 앞에 붙임
- 이미지: 티스토리 CDN 주소는 서명이 만료되므로 전부 내려받아 assets/images/posts/tistory/{글번호}/ 에 저장

사용:  python -I _tools/tistory_port.py --cache <html 캐시 폴더>
"""
import argparse
import hashlib
import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from markdownify import MarkdownConverter
from PIL import Image

BLOG = "https://wanggonya.tistory.com"
ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "_posts"
IMAGES = ROOT / "assets" / "images" / "posts" / "tistory"
UA = {"User-Agent": "Mozilla/5.0 (blog migration; owner)"}
MAX_W = 1600


def fetch(url, cache_dir=None, name=None):
    if cache_dir and name:
        p = Path(cache_dir) / name
        if p.exists() and p.stat().st_size:
            return p.read_text(encoding="utf-8")
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    r.encoding = "utf-8"
    if cache_dir and name:
        (Path(cache_dir) / name).write_text(r.text, encoding="utf-8")
        time.sleep(0.4)
    return r.text


def post_ids(cache_dir):
    xml = fetch(f"{BLOG}/sitemap.xml")
    ids = sorted({int(m) for m in re.findall(rf"<loc>{re.escape(BLOG)}/(\d+)</loc>", xml)})
    return ids


def category_key(name):
    # "Web (~2022.06)" → "Web"
    name = re.sub(r"\s*\(.*?\)\s*", "", name).strip()
    return re.sub(r"[^\w-]", "", name, flags=re.UNICODE) or "Etc"


def slugify(title):
    s = re.sub(r"\[[^\]]*\]", " ", title.lower())
    s = re.sub(r"[^\w\s-]", " ", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s.strip())
    return re.sub(r"-+", "-", s)[:50].strip("-") or "post"


# ── 이미지 ─────────────────────────────────────────────

def download_image(url, dest_dir, n):
    existing = sorted(dest_dir.glob(f"{n:02d}.*")) if dest_dir.exists() else []
    if existing:  # 다시 돌릴 때는 이미 받은 이미지 재사용
        return existing[0]
    if url.startswith("//"):
        url = "https:" + url
    r = requests.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    data = r.content
    ctype = r.headers.get("Content-Type", "").split(";")[0]
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
           "image/svg+xml": "svg", "image/bmp": "bmp"}.get(ctype)
    if not ext:
        try:
            ext = (Image.open(io.BytesIO(data)).format or "png").lower().replace("jpeg", "jpg")
        except Exception:
            ext = "png"
    # 너무 큰 사진은 가로 1600px로 줄임 (GIF·SVG 제외)
    if ext in ("jpg", "png", "webp", "bmp"):
        try:
            im = Image.open(io.BytesIO(data))
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
                buf = io.BytesIO()
                if ext == "jpg":
                    im.convert("RGB").save(buf, "JPEG", quality=88, optimize=True)
                else:
                    if ext == "bmp":
                        ext = "png"
                    im.save(buf, "PNG", optimize=True)
                data = buf.getvalue()
        except Exception:
            pass
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / f"{n:02d}.{ext}"
    path.write_bytes(data)
    return path


# ── HTML → Markdown ─────────────────────────────────────

class TistoryConverter(MarkdownConverter):
    def convert_pre(self, el, text, convert_as_inline):
        lang = el.get("data-ke-language") or ""
        if not lang:
            cls = [c for c in (el.get("class") or []) if c not in ("hljs",)]
            lang = cls[0] if cls else ""
        if lang in ("angelscript", "reasonml", "prolog", "hsp", "plaintext", "markdown"):
            lang = {"hsp": "python"}.get(lang, "")
        code = el.get_text()
        fence = "````" if "```" in code else "```"
        return f"\n\n{fence}{lang}\n{code.rstrip()}\n{fence}\n\n"

    def convert_u(self, el, text, convert_as_inline):
        return text

    def convert_span(self, el, text, convert_as_inline):
        return text

    def convert_figcaption(self, el, text, convert_as_inline):
        return ""


def table_is_simple(table):
    if table.find(["table", "pre", "img", "ul", "ol", "h2", "h3", "h4", "blockquote"]):
        return False
    if table.find(attrs={"colspan": True}) or table.find(attrs={"rowspan": True}):
        return False
    rows = table.find_all("tr")
    return len(rows) >= 2 and all(len(r.find_all(["td", "th"])) >= 2 for r in rows)


def clean_html_table(table):
    for t in table.find_all(True):
        for a in list(t.attrs):
            if a not in ("colspan", "rowspan", "href", "src", "alt"):
                del t.attrs[a]
    return str(table)


def preprocess(content, soup, img_dir, img_prefix, stats):
    # 광고·스크립트 제거
    for t in content.select("script, style, ins, .revenue_unit_wrap, [data-tistory-react-app]"):
        t.decompose()

    # 이미지: 내려받고 로컬 경로로 교체, 캡션은 이미지 아래 기울임 문단으로
    n = 0
    for fig in content.find_all("figure"):
        if fig.get("data-ke-type") == "opengraph":
            a = fig.find("a", href=True)
            title = fig.select_one(".og-title")
            link = soup.new_tag("p")
            if a:
                ta = soup.new_tag("a", href=a["href"])
                ta.string = "🔗 " + (title.get_text(strip=True) if title else a["href"])
                link.append(ta)
            fig.replace_with(link)
            continue
        cap = fig.find("figcaption")
        cap_text = cap.get_text(" ", strip=True) if cap else ""
        imgs = fig.find_all("img")
        if not imgs:
            continue
        holder = soup.new_tag("div")
        for img in imgs:
            src = img.get("src") or img.get("data-src") or ""
            if not src or "no-image" in src:
                continue
            n += 1
            try:
                p = download_image(src, img_dir, n)
                stats["images"] += 1
                new = soup.new_tag("img", src=f"{img_prefix}/{p.name}", alt=img.get("alt") or cap_text or "")
            except Exception as e:
                stats["image_errors"].append(f"{src[:80]}: {e}")
                new = soup.new_tag("img", src=src, alt=img.get("alt") or "")
            para = soup.new_tag("p")
            para.append(new)
            holder.append(para)
        if cap_text:
            c = soup.new_tag("p")
            em = soup.new_tag("em")
            em.string = cap_text
            c.append(em)
            holder.append(c)
        fig.replace_with(holder)

    # figure 밖에 있는 이미지
    for img in content.find_all("img"):
        src = img.get("src", "")
        if src.startswith(img_prefix) or not src or "no-image" in src:
            continue
        n += 1
        try:
            p = download_image(src, img_dir, n)
            stats["images"] += 1
            img["src"] = f"{img_prefix}/{p.name}"
        except Exception as e:
            stats["image_errors"].append(f"{src[:80]}: {e}")

    # 더보기(moreLess) → 굵은 제목 + 내용
    for ml in content.select('[data-ke-type="moreLess"]'):
        label = ml.get("data-text-more") or "더보기"
        body = ml.select_one(".moreless-content") or ml
        b = soup.new_tag("p")
        strong = soup.new_tag("strong")
        strong.string = f"▼ {label}"
        b.append(strong)
        ml.insert_before(b)
        ml.replace_with(body)

    for t in content.select('[data-ke-type="contentSearch"]'):
        a = t.find("a", href=True)
        if a:
            p = soup.new_tag("p")
            na = soup.new_tag("a", href=a["href"])
            na.string = "🔗 " + (a.get_text(" ", strip=True) or a["href"])
            p.append(na)
            t.replace_with(p)
        else:
            t.decompose()

    # 표: 단순한 표는 마크다운, 한 칸짜리 안내 상자는 인용문, 나머지는 HTML 그대로
    tables = []
    for table in content.find_all("table"):
        if table.find_parent("table"):
            continue
        cells = table.find_all(["td", "th"])
        if len(cells) == 1:
            bq = soup.new_tag("blockquote")
            for child in list(cells[0].contents):
                bq.append(child)
            table.replace_with(bq)
        elif not table_is_simple(table):
            token = f"TABLEHTML{len(tables)}TOKEN"
            tables.append(clean_html_table(table))
            p = soup.new_tag("p")
            p.string = token
            table.replace_with(p)

    # 굵게·밑줄 등 인라인 태그 안의 <br>은 마크다운 변환 때 사라지므로 태그를 br 기준으로 쪼갬
    inline = {"b", "strong", "u", "span", "em", "i", "s", "a", "font"}
    for br in content.find_all("br"):
        while br.parent is not None and br.parent.name in inline:
            parent = br.parent
            right = soup.new_tag(parent.name, attrs=dict(parent.attrs))
            for sib in list(br.next_siblings):
                right.append(sib.extract())
            parent.insert_after(br.extract())
            br.insert_after(right)

    # 제목 안의 줄바꿈: 첫 줄만 제목으로 두고 나머지는 아래 문단으로 분리
    for h in content.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        brs = h.find_all("br")
        if not brs:
            continue
        first = brs[0]
        rest = soup.new_tag("p")
        for sib in list(first.next_siblings):
            rest.append(sib.extract())
        first.decompose()
        if rest.get_text(strip=True):
            h.insert_after(rest)

    # 본문 글자 속 <head> 같은 꺾쇠가 HTML로 해석되지 않도록 이스케이프 (코드 안은 그대로)
    for s in content.find_all(string=True):
        if ("<" in s or ">" in s) and not s.find_parent(["pre", "code"]):
            s.replace_with(str(s).replace("<", "&lt;").replace(">", "&gt;"))
    return tables


def to_markdown(content, tables):
    md = TistoryConverter(heading_style="ATX", bullets="-", strong_em_symbol="*",
                          escape_underscores=False, escape_asterisks=False,
                          escape_misc=False).convert_soup(content)
    md = md.replace(" ", " ")
    for i, html in enumerate(tables):
        md = md.replace(f"TABLEHTML{i}TOKEN", "\n" + html + "\n")

    # 코드 블록 밖의 줄 정리: &nbsp; 들여쓰기가 코드 블록으로 오인되지 않게 앞 공백 제거,
    # 제목 안 굵게 표시 제거, 빈 제목 제거 (목록 들여쓰기는 유지)
    out, fence = [], None
    for line in md.split("\n"):
        m = re.match(r"^\s*(`{3,})", line)
        if m:
            if fence is None:
                fence = m.group(1)
            elif m.group(1) == fence:
                fence = None
            out.append(line.strip() if fence is None or m else line)
            continue
        if fence is not None:
            out.append(line)
            continue
        if re.match(r"^\s*([-*+]|\d+\.)\s", line):
            out.append(line.rstrip())
            continue
        q = re.match(r"^((?:>\s?)+)(.*)$", line.strip())
        if q:
            line = q.group(1).replace(" ", "") + " " + q.group(2).strip()
        else:
            line = line.strip()
        hm = re.match(r"^(#{1,6})\s*(.*)$", line)
        if hm:
            text = hm.group(2).replace("**", "").strip()
            line = f"{hm.group(1)} {text}" if text else ""
        out.append(line.rstrip())
    md = "\n".join(l for l in out if l.strip() not in ("****", "** **"))  # 빈 굵게 표시 제거
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip() + "\n"


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def port(post_id, cache_dir, stats):
    html = fetch(f"{BLOG}/{post_id}", cache_dir, f"{post_id}.html")
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one(".contents_style")
    if content is None:
        stats["skipped"].append(post_id)
        return None

    ld = {}
    for sc in soup.find_all("script", type="application/ld+json"):
        try:
            ld = json.loads(sc.string)
            break
        except Exception:
            pass
    title = soup.find("meta", property="og:title")["content"].strip()
    m = re.search(r'"categoryLabel":"([^"]*)"', html)
    label = json.loads(f'"{m.group(1)}"') if m else "Etc"
    parts = [p.strip() for p in label.split("/") if p.strip()]
    top = parts[0] if parts else "Etc"
    cat_name = re.sub(r"\s*\(.*?\)\s*", "", top).strip()
    cat_key = category_key(top)
    tags = [unquote(a.get_text(strip=True)) for a in soup.select('a[rel="tag"]')]
    if len(parts) > 1:
        tags = [parts[1]] + [t for t in tags if t != parts[1]]

    published = ld.get("datePublished", "")
    modified = ld.get("dateModified", "")
    date = published[:10]
    img_prefix = f"/assets/images/posts/tistory/{post_id}"
    tables = preprocess(content, soup, IMAGES / str(post_id), img_prefix, stats)
    body = to_markdown(content, tables)
    if "{{" in body or "{%" in body:
        body = "{% raw %}\n" + body + "{% endraw %}\n"

    headings = len(re.findall(r"^#{1,4} ", body, flags=re.M))
    fm = [
        "---",
        f"title: {yaml_str(title)}",
        "categories:",
        f"  - {yaml_str(cat_name)}",
        "tags:",
        *[f"  - {yaml_str(t)}" for t in tags],
        f"permalink: /{cat_key.lower()}/{post_id}/",
        f"date: {published}",
        f"last_modified_at: {modified}" if modified else None,
        f"toc: {'true' if headings >= 3 else 'false'}",
        "toc_sticky: true" if headings >= 3 else None,
        f"tistory_url: {BLOG}/{post_id}",
        "---",
        "",
    ]
    text = "\n".join(l for l in fm if l is not None) + "\n" + body
    out = POSTS / cat_key / f"{date}-{post_id}-{slugify(title)}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8", newline="\n")
    stats["posts"].append((post_id, cat_name, out.relative_to(ROOT).as_posix()))
    return cat_name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True, help="글 HTML 캐시 폴더")
    ap.add_argument("--only", type=int, nargs="*", help="특정 글 번호만")
    args = ap.parse_args()
    Path(args.cache).mkdir(parents=True, exist_ok=True)
    ids = args.only or post_ids(args.cache)
    stats = {"posts": [], "images": 0, "image_errors": [], "skipped": []}
    cats = set()
    for i, pid in enumerate(ids, 1):
        c = port(pid, args.cache, stats)
        if c:
            cats.add(c)
        print(f"[{i}/{len(ids)}] {pid} {'ok' if c else 'skip'}", flush=True)
    print(json.dumps({"posts": len(stats["posts"]), "images": stats["images"],
                      "image_errors": stats["image_errors"], "skipped": stats["skipped"],
                      "categories": sorted(cats)}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
