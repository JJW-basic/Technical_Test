# 웹 스크래핑 기능 구현 계획

## 개요

현재 `docker-compose up` 및 `health` API는 정상 동작 중이나, `/api/scrape` 엔드포인트는 스텁(stub) 상태이며 실제 스크래핑 로직이 연결되어 있지 않음. 프론트엔드 결과 출력 UI도 기존의 키워드별 카드 형태이며, 마크다운 콘텐츠 표시 및 키워드 강조 기능이 없음.

---

## 구현 범위

### Backend (`backend/app/`)

#### [MODIFY] [main.py](file:///d:/08_Technical_Test/backend/app/main.py)
- `ScrapingRequest` → `url: str`, `keywords: List[str]` 유지
- `ScrapingResponse` 신규 모델 추가:
  - `status`: `"success"` | `"policy_denied"` | `"path_denied"`
  - `domain`: 도메인명
  - `markdown_file`: 저장된 마크다운 파일명
  - `markdown_content`: 마크다운 파일 전체 내용
  - `keyword_counts`: `{keyword: count}` 딕셔너리
  - `message`: 사용자 메시지
- `/api/scrape` POST 엔드포인트에서 `scraper.py`의 전체 파이프라인 호출:
  1. URL/keyword 유효성 검증 (FastAPI Pydantic으로 자동 처리)
  2. robots.txt 등 4개 정책 파일 비동기 조회
  3. 정책 파싱 후 허용 여부 분기
  4. 허용 시 → 스크래핑 → 마크다운 저장 → 키워드 카운팅
  5. 결과 JSON 반환

#### [MODIFY] [scraper.py](file:///d:/08_Technical_Test/backend/app/scraper.py)
- `fetch_policy_files`: 동기 래퍼를 제거하고 **순수 async** 함수로 변경 (FastAPI는 이미 asyncio event loop에서 실행되므로 `asyncio.run()` 중첩 금지)
- `parse_robots_for_path`: 특정 URL 경로가 허용/거부되는지 세밀하게 체크하는 함수 추가
- `scrape_content`: 이미지 제외 유지, `httpx` 기반 정적 스크래핑 (Playwright는 Phase 2)
- `save_markdown`: 호스트명에서 TLD/서브도메인 제거 (`www.naver.com` → `naver`) 로직 강화
- `count_keywords`: 변경 없음 (정상 동작)

---

### Frontend (`frontend/src/`)

#### [MODIFY] [App.tsx](file:///d:/08_Technical_Test/frontend/src/App.tsx)

**UI/UX 상태 머신:**
- `idle` → 초기 폼 표시
- `loading` → 진행 중 애니메이션 (단계별 메시지: 정책 확인 중 → 스크래핑 중 → 분석 중)
- `error` → 에러 메시지 + 초기화 버튼
- `success` → 분석 결과 리포트

**입력 검증:**
- URL, 키워드 중 하나라도 빈 값이면 클라이언트 측에서 `"정상적인 접근이 아닙니다."` 표시 후 폼 리셋

**로딩 UX:**
- 진행 단계 표시: `정책 파일 확인 중...` → `페이지 스크래핑 중...` → `키워드 분석 중...`
- 단계는 타이머 기반으로 시각적으로 전환 (실제 API 응답까지 대기)

**결과 리포트 (`AnalysisReport` 컴포넌트):**
- 스크래핑한 URL, 도메인명, 저장 파일명 표시
- 키워드별 출현 횟수 배지(badge) 표시
- 마크다운 콘텐츠를 pre/code 블록으로 렌더링하되, 키워드를 `<mark>` 스타일로 강조 (색상, 폰트 크기 강조)
- 키워드가 0건인 경우 `"사용자가 요청한 정보가 없습니다."` 명시

**에러 메시지 분기:**
- `policy_denied`: URL 입력 필드 클리어 + `"해당 요청을 {domain}에서 거부합니다."` 표시
- `path_denied`: URL 입력 필드 클리어 + `"{domain}의 보안 정책상 허용되지 않는 URL 경로입니다."` 표시

---

### docker-compose.yml

#### [MODIFY] [docker-compose.yml](file:///d:/08_Technical_Test/docker-compose.yml)

백엔드 컨테이너에 `scraped_data` 볼륨 마운트 추가:
```yaml
volumes:
  - ./backend:/app
  - ./scraped_data:/app/scraped_data
```
호스트에서도 스크래핑 결과 마크다운을 확인할 수 있도록 바인드 마운트.

---

## 기술적 결정 사항

> [!IMPORTANT]
> **asyncio 중첩 이슈**: 기존 `scraper.py`의 `fetch_policy_files`는 FastAPI의 이미 실행 중인 event loop 안에서 `asyncio.run()`을 재호출하므로 런타임 오류가 발생함. 순수 `async def`로 리팩토링 필수.

> [!IMPORTANT]
> **마크다운 파일 저장 경로**: 컨테이너 내부 경로는 `/app/scraped_data/{host}/`. docker-compose 볼륨으로 호스트의 `./scraped_data/`에도 동기화.

> [!NOTE]
> **Playwright 비활성화**: 현재 Phase 1이므로 모든 스크래핑은 `httpx` + `BeautifulSoup4`만 사용. Playwright 분기 코드는 유지하되 기본값 `False`.

> [!NOTE]
> **robots.txt 파싱**: 완전한 규칙 파싱(User-agent별, Allow/Disallow 우선순위)을 구현. `Disallow: /` (전체 차단) 과 특정 경로 차단을 구분.

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

# 정책 거부 사이트 테스트 (예: 차단 robots.txt가 있는 사이트)
curl -X POST http://localhost/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.naver.com","keywords":["네이버"]}'
```

### 수동 검증
- 브라우저에서 `http://localhost` 접속 → 폼 입력 → 분석 요청
- 로딩 단계 애니메이션 정상 표시 확인
- 결과 리포트에서 키워드 강조 색상 확인
- 에러 케이스(URL 미입력, 정책 거부) 메시지 확인
