# Web Scraping Feature Implementation Plan

## Goal Description
Implement a robust web‑scraping workflow triggered by the "분석 요청하기" button. The workflow validates input, respects site policies, scrapes content (excluding images), stores results in domain‑named folders, generates markdown files, counts user‑provided keywords, and returns a highlighted analysis report to the UI.

## User Review Required
> [!IMPORTANT]
> Review the revised backend and frontend changes. Confirm the local storage location and the use of Playwright for dynamic pages.

## Open Questions (Updated)
> [!WARNING]
> - **Frontend framework version**: This refers to the version of React (and related tooling like Vite, TypeScript, TailwindCSS) used in the project. The plan assumes a recent stable release (e.g., React 18, Vite 5). Please confirm that these versions match your current `package.json`.
> - **Storage location**: For testing, the scraped markdown files will be saved locally on the host machine under a dedicated folder `scraped_data` (mounted as a Docker volume only when needed for production). This avoids any production‑level volume configuration while still persisting files during local development.
> - **Keyword matching**: All languages, including Korean, will use **case‑insensitive partial (substring) matching**. A keyword matches if its character sequence appears anywhere within a word or sentence.
> - **Dynamic pages**: Playwright will be used to render JavaScript‑heavy pages. Static HTML scraping (via `httpx` + `BeautifulSoup`) is faster and will be the default for pages without complex client‑side rendering. Playwright will be invoked when the URL returns a minimal HTML body or when a flag `use_playwright` is set (future extensibility). The plan documents the distinction between the two approaches.

## Proposed Changes
---
### Backend (FastAPI)
#### [NEW] `src/app/scraper.py`
- `fetch_policy_files(domain: str) -> dict` – Retrieves `robots.txt`, `humans.txt`, `security.txt`, `sitemap.xml` via `httpx`.
- `parse_policy(files: dict) -> dict` – Determines if crawling is allowed, blocked globally, or blocked for specific paths.
- `scrape_content(url: str, use_playwright: bool = False) -> str`
  - Default: `httpx` + `BeautifulSoup` to extract visible text, **excluding `<img>` tags**.
  - When `use_playwright=True`, launches Playwright (headless Chromium) to obtain the fully rendered page source before parsing.
- `save_markdown(domain: str, content: str) -> Path`
  - Creates a local folder under `scraped_data/{domain}` (e.g., `scraped_data/naver`).
  - Generates a file `scrap_{domain}_{NN}.md` where `NN` increments based on existing files.
- `count_keywords(md_path: Path, keywords: List[str]) -> dict`
  - Reads markdown content and **performs case‑insensitive partial substring search** for each keyword, regardless of language.
  - Returns a mapping `{keyword: count}`.

#### [MODIFY] `src/app/main.py`
- New POST endpoint `/api/scrape` accepting `{ url: str, keywords: List[str] }`.
- Validation: both fields required; missing fields → `422` with message "정상적인 접근이 아닙니다."
- Extract domain from URL; call `fetch_policy_files` and `parse_policy`.
  - If global disallow → `403` with message "{domain}에서 거부합니다."
  - If path blocked by `security.txt` → `403` with message "{domain}의 보안 정책상 허용되지 않는 URL 경로입니다."
  - Otherwise → proceed.
- Determine whether to use Playwright (e.g., based on a simple heuristic: if content‑type is `text/html` but body length < 500 bytes, fallback to Playwright). This logic can be refined later.
- Call `scrape_content`, `save_markdown`, and `count_keywords`.
- Return JSON:
  ```json
  {
    "keyword_counts": {"keyword1": 3, "keyword2": 0},
    "markdown_path": "scraped_data/naver/scrap_naver_01.md",
    "markdown_content": "..."
  }
  ```

#### [NEW] `src/app/models.py`
- Pydantic request/response schemas for type safety.

### Frontend (React + Vite + TypeScript)
#### [MODIFY] `src/components/AnalysisForm.tsx` (or the component that contains the form shown in `App.tsx`)
- On "분석 요청하기" button click, POST to `/api/scrape` with `{ url, keywords: keywords.split(',') }`.
- Show a **loading spinner / progress bar** while awaiting the response.
- On error (422 or 403), display the server‑provided message and reset the form to the initial state.
- On success, render a **분석 결과 리포트** section:
  - Display keyword occurrence counts.
  - Render the markdown content using `react-markdown`.
  - Highlight each keyword occurrence using a custom `remark` plugin or a simple wrapper component that injects `<span className="keyword-highlight">` with distinct color and enlarged font.

#### [NEW] `src/utils/highlightKeywords.ts`
- Function `highlight(text: string, keywords: string[]): string` that wraps found substrings with `<span class="keyword-highlight">`.
- Export CSS for `.keyword-highlight` (e.g., `color: #ffcc00; font-weight: bold; font-size: 1.05em;`).

#### Styling (CSS)
- Add `.keyword-highlight` to the global stylesheet with a premium color gradient to satisfy the aesthetic requirement.

### Docker / Development
- Add a **local development volume** for scraped data:
  ```yaml
  fastapi:
    volumes:
      - ./scraped_data:/app/scraped_data
  ```
- Ensure the `scraped_data` directory exists (`mkdir -p scraped_data`). This volume is only needed for local testing; production can mount a different persistent store.

## Verification Plan
### Automated Tests
- Unit tests for `scraper.fetch_policy_files` with mocked HTTP responses.
- Unit tests for `scraper.scrape_content` confirming images are omitted.
- Unit tests for `scraper.count_keywords` verifying case‑insensitive partial matching across Korean and English.
- Integration test exercising `/api/scrape` with valid/invalid inputs and checking status codes/messages.
- Frontend unit test (React Testing Library) asserting the loading indicator appears, errors are shown, and keyword highlighting works.

### Manual Verification
- Run the app locally, input a URL that returns static HTML and one that requires JavaScript rendering.
- Confirm markdown files appear under `scraped_data/{domain}` with correct incremental naming.
- Verify the analysis report shows correct counts and highlighted keywords.
- Test a site that disallows crawling via `robots.txt` to see the proper error handling.

---
*Revised implementation plan created. Please review and approve to proceed.*
