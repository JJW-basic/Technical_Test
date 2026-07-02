# Web Keyword Scraper & Information Aggregator

이 프로젝트는 지정한 웹 사이트의 콘텐츠를 스크래핑하여 관심 키워드의 출현 빈도를 분석하고, 수집된 정보를 마크다운 형태로 정형화하여 제공하는 웹 서비스입니다. 
로컬 개발 환경에서는 Docker Compose를 기반으로 다중 컨테이너 환경을 격리 및 유기적으로 연결하여 운영합니다.

---

## 1. 아키텍처 및 기술 스택 (Technology Stack)

본 프로젝트는 OCI Ampere A1 (ARM64) 및 Oracle Linux 환경으로의 최종 배포를 고려하여 설계되었으며, 로컬 환경에서 다음과 같은 기술 스택을 활용합니다.

| 레이어 (Layer) | 기술 스택 (Tech Stack) | 주요 역할 및 상세 내용 |
| :--- | :--- | :--- |
| **Reverse Proxy** | Nginx | • 호스트 80 포트 단일 진입점 관리<br>• 정적 에셋 및 프론트엔드 라우팅(`/`)과 백엔드 API 라우팅(`/api/*`) 처리<br>• 로컬 개발 환경 내 CORS 제한 원천 제거 |
| **Frontend** | React, TypeScript, Vite, TailwindCSS, Lucide React | • 사용자 입력 폼 및 로딩 상태 트래킹을 위한 SPA 인터페이스 제공<br>• 실시간 핫 리로딩(HMR) 지원을 위한 WebSocket 프록시 연동<br>• 분석 결과 마크다운 렌더링 및 키워드 하이라이팅 적용 |
| **Backend** | FastAPI, Python (>=3.11), uv | • 비동기(Asyncio) 기반의 고성능 REST API 서버 구동<br>• `uv` 패키지 매니저를 통한 의존성 빌드 캐싱 최적화<br>• robots.txt 파싱 및 경로 제한 준수 여부 사전 검증 엔진 탑재 |
| **Task Queue** | Taskiq, Redis (7-alpine) | • 비동기 백그라운드 작업 처리를 위한 Taskiq 프레임워크 사용<br>• Redis 메모리 DB 기반 메시지 브로커 연동 (BRPOP 무한 타임아웃 예외 처리 완료) |
| **Scraping Engine** | Crawl4AI, Playwright | • 브라우저 자동화 도구 Playwright(Headless 브라우저) 활용<br>• 이미지, 미디어 등 불필요 데이터를 필터링하고 최적의 LLM용 마크다운 형식 데이터 추출 |

---

## 2. 프로젝트 디렉토리 구조 (Directory Structure)

```text
d:\08_Technical_Test
├── .agents/                 # 프로젝트 전용 에이전트 규칙 및 설정 파일
├── backend/                 # FastAPI 백엔드 어플리케이션 및 비동기 워커 소스
│   ├── app/
│   │   ├── main.py          # API 엔드포인트 정의 및 크롤링 파이프라인 관리
│   │   ├── scraper.py       # robots.txt 정책 확인, Crawl4AI 스크래핑 기능 구현
│   │   └── tasks.py         # Taskiq 비동기 작업 정의 및 Redis 브로커 설정
│   ├── Dockerfile
│   └── pyproject.toml       # Python 패키지 의존성 정의 파일
├── frontend/                # React 프론트엔드 어플리케이션 소스
│   ├── src/
│   │   ├── App.tsx          # 메인 UI 컴포넌트, 로딩 인디케이터 및 키워드 강조
│   │   ├── index.css
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── nginx/                   # Nginx 리버스 프록시 설정
│   ├── nginx.conf
│   └── Dockerfile
├── scraped_data/            # 스크래핑 완료된 마크다운 파일 저장소 (볼륨 바인딩)
├── docker-compose.yml       # 다중 컨테이너 오케스트레이션 구성 파일
└── vibe_log.md              # 바이브 코딩 개발 히스토리 및 분석 로그
```

---

## 3. 현재 구현 범위 (Current Features)

현재 시스템은 **Phase 1 (DB-less, 로컬 환경 기능 구현)** 단계에 있습니다.
* **단일 URL 기반 크롤링**: 사용자가 입력한 단일 웹 페이지 URL에 접속하여 텍스트 정보를 추출합니다.
* **다중 키워드 매칭**: 사용자가 입력한 쉼표(`,`) 구분 기반의 여러 키워드 조합에 대해 본문 내 출현 빈도를 계측합니다.
* **사이트 컴플라이언스 준수 검증**:
  - `robots.txt`, `humans.txt`, `security.txt`, `sitemap.xml` 4대 메타데이터 파일을 사전에 비동기 병렬 검증합니다.
  - 전면 자동화 수집 거부(`Disallow: /`) 혹은 타겟 경로가 수집 차단 경로(`Disallow: /path`)에 해당하는 경우 크롤링을 중단하고 예외를 프론트엔드로 전달합니다.
* **로컬 파일 보관**: 수집한 원문 데이터를 호스트명 기반 디렉토리 구조 아래 마크다운 파일로 영구 저장합니다.

---

## 4. 로드맵 및 개선 계획 (Future Roadmap)

향후 프로젝트 고도화를 위해 단계적으로 다음과 같이 기능을 확장해 나갈 계획입니다.

### [Phase 2] 다중 URL 및 키워드 동시 처리 (개선 계획)
* **입력 형식 확장**: 단일 URL 입력 창에서 개행 또는 텍스트 목록 형태로 다수의 URL 리스트를 동시 접수하도록 개선합니다.
* **스크래핑 결과 요약화**: 여러 대상 사이트의 정보 속에서 설정한 키워드군을 추출 및 교차 비교하여, 통합 리포트 형태로 가시화합니다.
* **비동기 큐 활성화**: 다중 URL 요청 시 서비스 가용성 확보를 위해 Taskiq-Redis 백그라운드 비동기 태스크 큐의 분산 처리를 전면 활성화합니다.

### [Phase 3] 최신 정보 모니터링 시스템 구축 (최종 목표)
* **관심 사이트 리스트 관리**: 사용자가 상시 모니터링하기 원하는 타겟 정보 사이트의 목록을 등록 및 편집할 수 있도록 합니다.
* **스케줄링 기반 자동 갱신**: 크론(Cron) 스케줄러를 도입하여 주기적으로 등록된 사이트의 최신 글을 수집합니다.
* **최신 정보 대시보드**: 신규 업데이트된 정보에서 키워드를 감지하고, 수집 주기별 변경점만을 요약 정리하여 보여주는 모니터링 대시보드를 제공합니다.
