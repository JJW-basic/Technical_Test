---
trigger: always_on
---

# Background & Context
1. Goal: 정보를 정리해주는 웹서비스 구축
2. Working Environment: Local Windows OS ('Anti-gravity' IDE 기반 Vibe Coding) -> Target: OCI Ampere A1 (ARM64), Oracle Linux 8/9
3. Project Evolution Roadmap:
	- Phase 1 (CURRENT): DB-less, 로컬 환경 기능 구현 및 테스트
	- Phase 2 (Future): RDBMS, OCI 환경 웹 서비스 배포 (Stateless, Redis 기반 상태 및 큐 관리)
4. Input Data: URL 주소, 관심 키워드
5. Output Format:
	- URL 접근 시 입력한 키워드가 확인된 경우: URL를 포함한 출처 정보, 입력한 키워드 관련 정보
	- URL 접근 시 입력한 키워드가 없는 경우: URL를 포함한 출처 정보, '사용자가 요청한 정보가 없습니다.' 명시	


# Architecture & Tech Stack
1. Infra & Container Orchestration Layer
	- Docker & Docker Compose (컨테이너 기반 로컬 멀티 프로세스 격리 및 오케스트레이션)
		- 백엔드, 워커, 프론트엔드, 인메모리 DB, 리버스 프록시(Nginx)를 각각 별도 컨테이너로 분리
		- 볼륨 바인딩(Volume Binding)을 통한 소스 코드 실시간 동기화 (Vite HMR & FastAPI Reload 유지)
	- Nginx (Reverse Proxy & Web Server)
		- 역할: 호스트(Windows) 포트 80(또는 지정 포트)을 독점하는 단일 엔드포인트 구축
		- 라우팅 메커니즘: 정적 에셋 및 프론트엔드 라우팅(/)은 React 컨테이너로 프록시, API 요청(/api/*)은 FastAPI 컨테이너로 업스트림(Upstream) 라우팅
		- 이점: 로컬 개발 환경 내 CORS 미들웨어 의존성 제거, HTTP 헤더 제어 최적화
2. Application Layer
	- Frontend: React (Vite) + TypeScript (SPA) + TailwindCSS
	- Backend: FastAPI + uv (Package Manager, Dockerfile 내 멀티스테이지 빌드 캐싱 최적화)
3. Task & Event Infrastructure
	- Task Queue: Taskiq + Redis (공식 Redis Docker Image 활용)
4. Data Acquisition Engine
	- Crawling: HTTPX + BeautifulSoup4 (정적 링크 고속 탐색)
	- Scraping Core: Crawl4AI (LLM용 마크다운 변환 및 정제)
	- Browser Automation Engine: Playwright (Async Python)
		- 런타임 환경: Playwright 공식 파이썬 도커 베이스 이미지(mcr.microsoft.com/playwright/python) 활용
		- 역할: 복잡한 인증(Session 로그인), 캡차(CAPTCHA) 우회 훅, 네트워크 데이터 인터셉트
5. Quality Assurance & DevOps Layer
	- E2E Testing / UI Automation: Playwright (TypeScript/Node.js)
		- 역할: 프론트엔드-백엔드 통합 테스트 자동화, 바이브 코딩 코드 무결성 검증


# Extreme Privacy Directives
1. Zero PII (Absolute Anonymity)
	- 이름, 나이, 전화번호, 이메일 등 식별 가능한 개인정보(PII)의 수집, 요청, 데이터 모델링 절대 금지


# Legal Compliance & Anti-Scraping Liability Guard
1. Pre-Execution Compliance Validation (사전 검증 의무화)
	- 임의의 대상 도메인(Domain)에서 데이터를 수집하기 전, 데이터 획득 엔진은 반드시 최우선적으로 아래 4대 메타데이터 파일의 존재 여부 및 콘텐츠를 비동기식으로 조회·파싱해야 한다.
		- `robots.txt` (로봇 배제 표준 규칙 검증)
		- `humans.txt` (운영자 식별 및 추가 수집 제약 조건 확인)
		- `security.txt` (보안 정책 및 크롤러 접근 차단 IP 범위 확인)
		- `sitemap.xml` (구조화된 URL 접근 허용 도메인 경로 추적)
2. Enforcement of Automation Bans (자동화 데이터 수집 금지 조항 강제)
	- 상기 4대 파일 분석 결과, 전면적인 자동화 데이터 수집 금지(예: `User-agent: * \n Disallow: /`) 조항이 탐지될 경우, 시스템은 즉시 크롤링/스크래핑 태스크(Task)를 중단(Abort)해야 한다.
	- 작업 중단 즉시 상위 파이프라인으로 예외를 전파하고, 클라이언트(프론트엔드) 스크린에 "해당 URL은 사이트 정책에 의해 자동화된 데이터 수집이 금지되어 있습니다."라는 명확한 법적 고지 문구를 렌더링해야 한다.
3. Partial Restrictive Path Routing (부분 금지 경로 우회 및 매핑)
	- 특정 경로에 대해서만 수집이 금지되고 일부 경로가 허용된 경우(Partial Disallow), 정규식 매칭을 통해 명시적으로 허용된 경로(Allowed Path) 및 패턴 내부에서만 정보 수집을 수행하도록 필터링 로직을 구현한다. 금지 경로 접근 시도는 사전에 차단한다.


# System Integration & Workflow
1. Routing (Nginx)
	- Nginx를 단일 진입점으로 설정 (정적 자산 -> React, `/api/*` -> FastAPI 라우팅)
2. Error Handling Strategy
	- FastAPI: HTTP 4xx, 5xx, Validation 에러에 대한 전역 예외 처리기(Global Exception Handler) 구현 및 구조화된 JSON 반환
	- Redis: 연결 실패 대비 Fallback/Circuit Breaker 패턴 적용 (침묵 실패 방지 및 HTTP 503 명확히 반환)
	- Compliance Exception: 사이트 규약에 따른 수집 차단 시, 시스템은 `HTTP 403 Forbidden` 또는 구조화된 비즈니스 로직 에러(예: `422 Unprocessable Entity` 내 커스텀 에러 코드)를 반환하여 프론트엔드가 이를 제어할 수 있도록 한다.


# System Directives & Reasoning Principles
1. Architecture-First Reasoning (아키텍처 최우선 추론)
	- 모든 문제 해결 시 고가용성(High Availability)과 무상태(Stateless) 분산 시스템 구조를 최우선으로 고려한다.
	- 기능 구현 전, 해당 로직이 OCI Ampere A1 (ARM64) 환경 및 멀티 플랫폼 Docker 빌드에서 정상 동작하는지 교차 검증한다.
2. Fail-Safe & Observability (장애 대비 및 가시성)
	- 시스템의 한 지점(예: Redis 연결 끊김, 외부 API 타임아웃)이 실패하더라도 전체 서비스가 중단되지 않도록 Fallback 패턴 및 명확한 에러 코드(HTTP 5xx, 4xx)를 반환하는 로직을 기본으로 탑재한다.
3. User-Centric Transparency (사용자 중심 투명성)
	- 클라이언트(프론트엔드)로 반환되는 모든 결과 메시지 및 가이드라인은 데이터에 기반하여 직관적으로 보여준다.
4. Cost-Aware Engineering (비용 인지 엔지니어링)
	- 컨테이너가 모두 안정적으로 동작할 수 있도록 각 컨테이너의 메모리 제한(Memory Limits) 및 경량화를 최우선으로 설계한다.
	- 현재 서비스 기능 구현에 허용하는 메모리 자원은 최대 6GB이다.


# Task Orchestration
1. Task Decomposition & Mapping
	- 요청사항 분석 후 Architecture 영역(React, FastAPI, Nginx, Redis 등)별 최소 작업 단위로 분해
	- 분해된 단위가 'Zero PII' 및 'Legal Compliance' 원칙에 위배되지 않는지 철저히 사전 검증
2. Logic Design & Draft
	- Stateless, 비동기, 다중 아키텍처 호환, 비용 효율화 지침을 준수하는 엔지니어링 해결책 초안 설계


# Logging Protocol
1. 모든 작업 완료 또는 변경 시 `./vibe_log.md` 업데이트 (파일 부재 시 즉시 생성).
2. 기존 내용 보존 및 최하단에 새 로그 추가.
3. 모든 시간은 한국 표준시(KST) 기준 기록.
4. 로그 작성 양식:
	## [YYYY-MM-DD HH:mm KST] - (성공✅/주의⚠️/오류❌) 작업 요약
	* **사용자 요청 요약 (User Request Summary):**
		- 사용자가 프롬프트(Prompt)를 통해 명시적으로 요구한 핵심 목표 및 제약 조건 기술
	* **에이전트 수행 작업 (Agent Actions & Execution):**
		- 요청을 이행하기 위해 에이전트가 내부적으로 수행한 작업 흐름(Workflow) (예: 코드 탐색, 정적 분석(Static Analysis), 의존성 트리 확인, 특정 컴포넌트 리팩토링, 오류 분석 스택 트레이스(Stack Trace) 추적 등)
	* **결과물 제공 근거 (Output Rationale & Intent):**
		- 최종 결과물(내용 설명, 코드 정리, 아키텍처 가이드라인, 마크다운 파일 등)을 사용자에게 전달한 구체적인 엔지니어링 목적 및 설계 판단 근거(Design Intent) 명시
	* **변경된 파일:** `파일명1`, `파일명2` (변경 없으면 `없음`)
	* **핵심 변경 사항:** (변경 없으면 `없음`)
		- [논리(Rationale)]: 수정 원인 및 적용한 엔지니어링 논리(Engineering Logic)
		- [기능(Functionality)]: 추가, 수정, 삭제된 구체적 기능 및 컴포넌트 인터페이스 변화
	* **결과 확인:** 로컬 테스트 수행 결과, 런타임 작동 여부, 발견된 이슈(Issue), 발견된 예외 사항(Exception) 또는 분석 결론
	* **참고:** 추가 설명, 차기 작업 체크리스트