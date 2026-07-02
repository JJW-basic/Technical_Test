# Web Scraping Feature Implementation Plan

## Goal Description
Implement a robust web scraping workflow triggered by the "분석 요청하기" button. The workflow validates input, respects site policies, scrapes content (excluding images), stores results in domain‑named folders, generates markdown files, counts user‑provided keywords, and returns a highlighted analysis report to the UI.

## User Review Required
> [!IMPORTANT]
> Review the proposed changes to both backend (FastAPI) and frontend (React) components. Ensure the folder structure for scraped data aligns with your deployment strategy and that the UI handling of loading/error states meets your design expectations.

## Open Questions
> [!WARNING]
> - **Frontend framework version**: Confirm the exact file paths for the analysis request button component (e.g., `src/components/AnalysisForm.tsx`).
> - **Storage location**: Should scraped markdown files be stored inside the FastAPI container's `/app/data` directory (mounted as a Docker volume) or another shared volume?
> - **Keyword matching**: Should we support only exact word matches or partial matches (e.g., substrings)?
> - **Dynamic pages**: Do you need Playwright for JavaScript‑rendered content now, or is static HTML sufficient?

## Proposed Changes
---
### Backend (FastAPI)
#### [NEW] `src/app/scraper.py`
- Implements `fetch_policy_files(domain: str) -> dict` to retrieve `robots.txt`, `humans.txt`, `security.txt`, `sitemap.xml` using `httpx`.
- Parses `robots.txt` for `Disallow: /` or `User-agent: *` rules; returns policy decisions.
- Implements `scrape_content(url: str) -> str` using `httpx` + `BeautifulSoup` to extract visible text while skipping `<img>` tags.
- Implements `save_markdown(domain: str, content: str) -> Path` that creates a folder named after the domain (e.g., `data/naver`) and generates a file `scrap_{domain}_{NN}.md` with incremental numbering.
- Implements `count_keywords(md_path: Path, keywords: List[str]) -> dict` (case‑insensitive for English, exact for others).

#### [MODIFY] `src/app/main.py`
- Add new POST endpoint `/api/scrape` accepting `{ url: str, keywords: List[str] }`.
- Validation: ensure both fields present; otherwise return `422` with message "정상적인 접근이 아닙니다."
- Call policy check; handle three outcomes:
  1. Disallowed => return `403` with message "{domain}에서 거부합니다."
  2. Path blocked by `security.txt` => return `403` with message "{domain}의 보안 정책상 허용되지 않는 URL 경로입니다."
  3. Allowed => proceed to scrape, save markdown, count keywords.
- Return JSON: `{ keyword_counts: { kw: count }, markdown_path: str, markdown_content: str }`.

#### [NEW] `src/app/models.py`
- Pydantic models for request/response schemas.

### Frontend (React + Vite + TypeScript)
#### [MODIFY] `src/components/AnalysisForm.tsx` (or appropriate component)
- On "분석 요청하기" click, POST to `/api/scrape`.
- Show loading spinner / progress indicator until response.
- Handle error responses: display the error message and reset to initial page.
- On success, display a "분석 결과 리포트" section:
  - Show keyword occurrence counts.
  - Render markdown content (using a markdown renderer library like `react-markdown`).
  - Highlight occurrences of each keyword with custom style (e.g., `<mark>` or styled `<span>` with larger font/color).

#### [NEW] `src/utils/highlightKeywords.ts`
- Utility to wrap keywords in markdown before rendering or use a custom renderer component.

### Docker / Deployment
- Add a volume mount in `docker-compose.yml` for the FastAPI service:
  ```yaml
  fastapi:
    volumes:
      - ./data:/app/data
  ```
- Ensure the `data` directory exists and is writable.

## Verification Plan
### Automated Tests
- Unit tests for `scraper.fetch_policy_files` with mock HTTP responses.
- Unit tests for `scraper.scrape_content` ensuring images are excluded.
- Integration test hitting `/api/scrape` with valid/invalid inputs, checking proper status codes and messages.
- Frontend test (using React Testing Library) that the loading indicator appears and the report renders with highlighted keywords.

### Manual Verification
- Run the app locally, input a known URL and keyword, verify folder creation, markdown file naming, and UI report with highlighted terms.
- Test disallowed domains (e.g., site with `Disallow: /`) to confirm proper error handling.

---
*Implementation plan created. Please review and approve to proceed.*
