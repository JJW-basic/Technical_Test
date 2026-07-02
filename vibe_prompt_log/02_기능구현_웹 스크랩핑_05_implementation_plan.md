# 웹 스크래핑 기능 구현 계획 (Rev.2)

## 개요

현재 `/api/scrape` 엔드포인트는 스텁(stub) 상태이며 실제 스크래핑 로직이 연결되어 있지 않음.
기존 코드베이스에 `httpx` + `BeautifulSoup4` 조합과 `Crawl4AI` + `Playwright` 조합이 **혼재**하여 구현 혼선이 발생함.

**본 계획은 `httpx` + `BeautifulSoup4` 조합을 프로젝트에서 완전히 제거하고, `Crawl4AI` + `Playwright` 단일 조합으로 스크래핑 엔진을 재구성한다.**

---

## User Review Required

> [!IMPORTANT]
> **`httpx` + `BeautifulSoup4` 완전 제거**: `pyproject.toml`에서 `httpx`와 `beautifulsoup4` 의존성을 삭제하고, `scraper.py`에서 관련 임포트 및 로직을 전부 걷어낸다. 정책 파일(robots.txt 등) 조회도 Crawl4AI의 내장 `AsyncWebCrawler`를 사용하는 방식으로 전환한다.

> [!IMPORTANT]
> **Docker 이미지 재빌드 필요**: `pyproject.toml` 의존성 변경으로 인해 `docker-compose up --build`를 통한 전체 이미지 재빌드가 필수다.

> [!WARNING]
> **정책 파일 조회 방식 변경**: 기존 `httpx`로 직접 HTTP GET 하던 방식 → Crawl4AI `AsyncWebCrawler`의 `arun()` 또는 Python 표준 `urllib.robotparser`로 전환. robots.txt 파싱은 표준 라이브러리 `urllib.robotparser.RobotFileParser`를 활용하고, humans.txt / security.txt / sitemap.xml은 Crawl4AI로 조회한다.

---

## 구현 범위

### Backend (`backend/`)

---

#### [MODIFY] [pyproject.toml](file:///d:/08_Technical_Test/backend/pyproject.toml)

**삭제할 의존성:**
```toml
# 제거 대상
"httpx>=0.27.0",
"beautifulsoup4>=4.12.3",
```

**유지/확인할 의존성 (Crawl4AI + Playwright 스택):**
```toml
"fastapi>=0.110.0",
"uvicorn>=0.28.0",
"taskiq[redis]>=0.11.0",
"taskiq-redis>=0.10.0",
"crawl4ai>=0.3.8",
"playwright>=1.42.0",
```

---

#### [MODIFY] [scraper.py](file:///d:/08_Technical_Test/backend/app/scraper.py)

**현재 문제점:**
- `httpx`, `BeautifulSoup` 임포트 및 `_extract_text()`, `scrape_content()` 함수 존재 → **전부 제거**
- `fetch_policy_files()`가 `asyncio.run()`을 내부에서 호출 → FastAPI event loop와 충돌하는 런타임 오류 → **전면 재작성**
- Playwright import를 `try/except`로 선택적 처리 → **필수 의존성으로 전환**

**재작성 방향 (`Crawl4AI` + `Playwright` 기반):**

1. **`fetch_policy_files(domain: str) → async`**
   - `urllib.robotparser.RobotFileParser`로 `robots.txt` 파싱 (표준 라이브러리, 외부 HTTP 의존 없음)
   - `humans.txt`, `security.txt`, `sitemap.xml` 존재 여부는 Crawl4AI `AsyncWebCrawler.arun()`으로 비동기 조회
   - `asyncio.run()` 사용 절대 금지 → 순수 `async def`

2. **`parse_robots_for_path(robots_content: str, url_path: str) → dict`**
   - `User-agent: *` 섹션의 `Disallow`/`Allow` 규칙을 파싱
   - **전체 차단** (`Disallow: /`) 과 **특정 경로 차단** 구분
   - 반환값: `{ "disallowed_all": bool, "path_denied": bool }`

3. **`scrape_page(url: str) → str`** ← `scrape_content()` 대체
   - `crawl4ai.AsyncWebCrawler` + `BrowserConfig(headless=True)` + `CrawlerRunConfig(word_count_threshold=10)` 사용
   - `result.markdown` 활용 (Crawl4AI가 LLM용 마크다운으로 자동 변환 및 이미지 제외 처리)
   - Playwright 브라우저 컨텍스트는 Crawl4AI가 내부적으로 관리

4. **`save_markdown(host_label: str, content: str) → Path`** ← 기존 유지 + 경로 수정
   - 저장 경로: `/app/scraped_data/{host_label}/scrap_{host_label}_{NN}.md`
   - `host_label` 추출 로직: `www.naver.com` → `naver` (서브도메인 및 TLD 제거)

5. **`count_keywords(md_path: Path, keywords: List[str]) → dict`** ← 변경 없음

---

#### [MODIFY] [main.py](file:///d:/08_Technical_Test/backend/app/main.py)

- **`ScrapingRequest`** 모델: `url: str`, `keywords: List[str]` 유지
- **`ScrapingResponse`** 신규 모델 추가:
  - `status`: `"success"` | `"policy_denied"` | `"path_denied"`
  - `domain`: 도메인명 (메시지 조합용)
  - `markdown_file`: 저장된 마크다운 파일명
  - `markdown_content`: 마크다운 파일 전체 내용
  - `keyword_counts`: `{keyword: count}` 딕셔너리
  - `message`: 사용자 표시 메시지
- **`/api/scrape` POST** 전체 파이프라인 연결:
  1. Pydantic 유효성 검증 (FastAPI 자동 처리)
  2. `fetch_policy_files()` → 4개 정책 파일 비동기 조회
  3. `parse_robots_for_path()` → 허용 여부 분기
  4. 차단 시 → `policy_denied` 또는 `path_denied` 상태 즉시 반환
  5. 허용 시 → `scrape_page()` → `save_markdown()` → `count_keywords()`
  6. `ScrapingResponse` JSON 반환

---

### Frontend (`frontend/src/`)

#### [MODIFY] [App.tsx](file:///d:/08_Technical_Test/frontend/src/App.tsx)

**UI/UX 상태 머신:**
- `idle` → 초기 폼 표시
- `loading` → 진행 중 애니메이션
- `error` → 에러 메시지 + 초기화 버튼
- `success` → 분석 결과 리포트

**입력 검증 (클라이언트):**
- URL, 키워드 중 하나라도 빈 값이면 `"정상적인 접근이 아닙니다."` 표시 후 폼 리셋
- API 요청 자체를 차단 (불필요한 서버 호출 방지)

**로딩 UX (단계별 메시지):**
- `정책 파일 확인 중...` → `페이지 스크래핑 중...` → `키워드 분석 중...`
- 타이머 기반으로 시각적 단계 전환 (실제 API 응답까지 대기)

**결과 리포트:**
- 스크래핑 URL, 도메인명, 저장 파일명 표시
- 키워드별 출현 횟수 배지(badge) 표시
- 마크다운 콘텐츠 내 키워드 강조 (색상 + 폰트 크기 강조)
- 키워드 0건인 경우 `"사용자가 요청한 정보가 없습니다."` 명시

**에러 메시지 분기:**
- `policy_denied`: URL 입력 필드 클리어 + `"해당 요청을 {domain}에서 거부합니다."` 표시
- `path_denied`: URL 입력 필드 클리어 + `"{domain}의 보안 정책상 허용되지 않는 URL 경로입니다."` 표시

---

### docker-compose.yml

#### [MODIFY] [docker-compose.yml](file:///d:/08_Technical_Test/docker-compose.yml)

`scraped_data` 볼륨 바인드 마운트 추가 (backend 및 worker 서비스):
```yaml
volumes:
  - ./backend:/app
  - ./scraped_data:/app/scraped_data
```
호스트 `./scraped_data/` 경로에서 스크래핑 결과 마크다운 파일 직접 확인 가능.

---

## 기술적 결정 사항

> [!IMPORTANT]
> **단일 스크래핑 엔진 원칙**: `httpx` + `BeautifulSoup4` 조합을 완전히 제거하여 이중 스택 혼재 문제를 근본적으로 차단. 모든 HTTP 요청 및 HTML 파싱은 `Crawl4AI` + `Playwright`로 일원화.

> [!IMPORTANT]
> **asyncio 중첩 이슈 해소**: 기존 `asyncio.run()` 래퍼 완전 삭제. `scraper.py` 내 모든 I/O 작업을 순수 `async def`로 재작성하여 FastAPI event loop와 안전하게 통합.

> [!NOTE]
> **robots.txt 파싱**: Python 표준 라이브러리 `urllib.robotparser.RobotFileParser` 사용. 외부 HTTP 라이브러리 의존 없이 `Disallow: /` (전체 차단)과 특정 경로 차단을 정확히 구분.

> [!NOTE]
> **이미지 제외**: Crawl4AI의 `result.markdown` 출력은 기본적으로 이미지 마크다운 문법(`![]()`)을 포함할 수 있음. `CrawlerRunConfig`의 `excluded_tags` 또는 후처리 정규식으로 이미지 구문 제거.

> [!NOTE]
> **마크다운 저장 경로**: 컨테이너 내부 `/app/scraped_data/{host_label}/`. docker-compose 볼륨 마운트로 호스트 `./scraped_data/`에 동기화.

---

## 검증 계획

### 자동화 테스트
```bash
# 헬스 체크
curl http://localhost/api/health

# 정책 허용 사이트 스크래핑 테스트
curl -X POST http://localhost/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","keywords":["example","domain"]}'

# 정책 거부 사이트 테스트
curl -X POST http://localhost/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.naver.com","keywords":["네이버"]}'
```

### 수동 검증
- `http://localhost` 접속 → 폼 입력 → 분석 요청
- 로딩 단계 애니메이션 정상 표시 확인
- 결과 리포트에서 키워드 강조 색상 확인
- 에러 케이스 (URL 미입력 / 정책 거부 / 경로 거부) 메시지 확인
- 호스트의 `./scraped_data/` 경로에서 마크다운 파일 생성 확인
