# 블로그 에디터

`https://wanggonya.github.io/edit/` 에서 노션처럼 글을 쓰고, **발행하기**를 누르면 GitHub 저장소에 바로 커밋되는 에디터.
커밋되면 GitHub Pages가 자동으로 다시 빌드해서 1~2분 뒤 블로그에 반영된다.

## 처음 한 번: 토큰 연결

1. <https://github.com/settings/personal-access-tokens/new> 에서 Fine-grained 토큰 생성
   - Repository access → **Only select repositories** → `wanggoNya/wanggoNya.github.io`
   - Permissions → Repository permissions → **Contents: Read and write**
   - 만료 기간은 원하는 대로 (만료되면 에디터에서 다시 연결)
2. `/edit/` 접속 → 토큰 붙여넣고 **연결하기**
3. 토큰은 그 브라우저의 localStorage에만 저장된다. 다른 기기에서 쓰려면 그 기기에서도 한 번 연결.

연결한 브라우저에서는 블로그 글 화면 오른쪽 아래에 **✏️ 이 글 편집 / ＋ 새 글** 버튼이 보인다 (방문자에게는 안 보임).

## 쓰는 법

| 동작 | 방법 |
|---|---|
| 블록 메뉴 | `/` 입력 (제목, 목록, 체크리스트, 코드, 표, 이미지 등) |
| 마크다운 단축 | `# ` 제목, `- ` 목록, `1. ` 번호 목록, `> ` 인용, ` ``` ` 코드 |
| 이미지 | 붙여넣기 또는 끌어다 놓기 → 발행할 때 `assets/images/posts/날짜-주소/` 로 함께 커밋 (가로 1600px 넘으면 자동 축소) |
| 발행 | **발행하기** 버튼 또는 `Ctrl+S` |
| 임시저장 | 자동 (이 브라우저에만). 다시 열면 "불러오기" 배너가 뜸 |
| 삭제 | 기존 글을 열고 **삭제** (커밋 기록에 남아서 되살릴 수 있음) |

- 저장 위치: `_posts/카테고리/YYYY-MM-DD-주소.md`, 주소(permalink)는 `/카테고리/주소/`
- 카테고리 목록은 `_pages/categories/*.md` 의 `taxonomy` 값에서 자동으로 가져온다. 새 카테고리는 거기에 페이지를 추가하면 된다.
- 기존 글의 front matter(permalink, excerpt 등)는 그대로 유지된다.

## 주의

- 마크다운 ↔ 블록 변환은 손실이 있을 수 있다. kramdown 전용 문법(`{: .notice}` 같은 속성, 각주, HTML 블록)이 있는 옛 글은 편집 후 모양이 달라질 수 있으니 확인할 것.
- 본문에 `{{ }}` / `{% %}` 를 쓰면 Jekyll(Liquid)이 해석하려 한다. 코드 예시라면 `{% raw %}…{% endraw %}` 로 감쌀 것.

## 에디터 코드 수정 시

소스는 `_editor/src/`, 빌드 결과는 `assets/editor/` (이게 실제로 서빙됨 — 커밋 필요).

```bash
cd _editor
npm install
npm run build      # assets/editor/ 갱신
```

`_editor/` 는 밑줄 폴더라 Jekyll이 무시한다. 구성: React 19 + BlockNote 0.57 + Vite, GitHub Git Data API로 글과 이미지를 커밋 하나로 묶어 올림.
