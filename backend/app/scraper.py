"""
scraper.py — Data Acquisition Engine
스크래핑 엔진: Crawl4AI + Playwright 단일 스택
의존성: crawl4ai, playwright (httpx/BeautifulSoup4 제거됨)
"""

import os
import re
import asyncio
import urllib.request
import urllib.robotparser
from pathlib import Path
from typing import List, Dict, Tuple
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig


# ---------------------------------------------------------------------------
# 1. 정책 파일 조회
# ---------------------------------------------------------------------------

async def fetch_robots_content(domain: str) -> Tuple[bool, str]:
    """
    robots.txt 존재 여부와 내용을 반환한다.
    urllib.robotparser 는 동기 I/O이므로 asyncio.to_thread 로 격리한다.
    """
    robots_url = f"https://{domain}/robots.txt"

    def _fetch() -> Tuple[bool, str]:
        try:
            req = urllib.request.Request(
                robots_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return True, resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, ""
            return False, ""
        except Exception:
            pass
        return False, ""

    return await asyncio.to_thread(_fetch)


async def fetch_policy_file(url: str) -> str:
    """
    Crawl4AI AsyncWebCrawler 로 단일 URL 콘텐츠를 가져온다.
    접근 실패 시 빈 문자열 반환.
    """
    browser_cfg = BrowserConfig(headless=True, verbose=False)
    run_cfg = CrawlerRunConfig(word_count_threshold=1, verbose=False)
    try:
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            result = await crawler.arun(url=url, config=run_cfg)
            if result.success:
                return result.markdown or result.html or ""
    except Exception:
        pass
    return ""


async def fetch_all_policy_files(domain: str) -> Dict[str, any]:
    """
    4대 정책 파일을 비동기 병렬 조회한다.
    robots.txt : urllib (표준 라이브러리)
    나머지 3종 : Crawl4AI
    반환: {"robots.txt": (exists, content), "humans.txt": str, "security.txt": str, "sitemap.xml": str}
    """
    base = f"https://{domain}"
    robots_task = fetch_robots_content(domain)
    humans_task = fetch_policy_file(f"{base}/humans.txt")
    security_task = fetch_policy_file(f"{base}/security.txt")
    sitemap_task = fetch_policy_file(f"{base}/sitemap.xml")

    robots_res, humans, security, sitemap = await asyncio.gather(
        robots_task, humans_task, security_task, sitemap_task
    )
    return {
        "robots.txt": robots_res,  # Tuple[bool, str]
        "humans.txt": humans,
        "security.txt": security,
        "sitemap.xml": sitemap,
    }


# ---------------------------------------------------------------------------
# 2. 정책 파싱
# ---------------------------------------------------------------------------

def parse_robots_for_path(robots_data: Tuple[bool, str], target_path: str) -> Dict[str, bool]:
    """
    robots.txt 존재 여부와 내용, 대상 경로를 받아 허용 여부를 반환한다.

    반환값:
        {
            "disallowed_all": bool,  # User-agent: * / Disallow: / 전체 차단
            "path_denied": bool,     # 특정 경로만 차단
        }
    """
    exists, robots_content = robots_data
    if not exists or not robots_content.strip():
        return {"disallowed_all": False, "path_denied": False}

    rules = []
    lines = robots_content.splitlines()
    current_agent_is_star = False
    has_any_disallow = False

    for line in lines:
        line = line.split('#')[0].strip()
        if not line:
            continue

        match_ua = re.match(r'^user-agent:\s*(.*)$', line, re.IGNORECASE)
        if match_ua:
            ua = match_ua.group(1).strip()
            if ua == '*':
                current_agent_is_star = True
            else:
                current_agent_is_star = False
            continue

        if current_agent_is_star:
            match_rule = re.match(r'^(disallow|allow)\s*:\s*(.*)$', line, re.IGNORECASE)
            if match_rule:
                rule_type = match_rule.group(1).lower()
                rule_path = match_rule.group(2).strip()
                if rule_type == 'disallow' and rule_path:
                    has_any_disallow = True
                rules.append({"type": rule_type, "path": rule_path})

    if not has_any_disallow:
        return {"disallowed_all": False, "path_denied": False}

    disallowed_all = False
    for r in rules:
        if r["type"] == "disallow" and r["path"] in ("*", "/"):
            disallowed_all = True
            break

    if disallowed_all:
        return {"disallowed_all": True, "path_denied": False}

    matching_rules = []
    for r in rules:
        if not r["path"]:
            if r["type"] == "disallow":
                matching_rules.append((0, "allow"))
            continue

        pattern = r["path"]
        escaped = ""
        for char in pattern:
            if char == '*':
                escaped += ".*"
            elif char == '$':
                escaped += "$"
            else:
                escaped += re.escape(char)

        if not escaped.endswith('$'):
            regex_str = '^' + escaped
        else:
            regex_str = '^' + escaped

        try:
            if re.match(regex_str, target_path):
                matching_rules.append((len(pattern), r["type"]))
        except Exception:
            if target_path.startswith(pattern):
                matching_rules.append((len(pattern), r["type"]))

    if matching_rules:
        matching_rules.sort(key=lambda x: x[0], reverse=True)
        longest_match = matching_rules[0]
        if longest_match[1] == "disallow":
            return {"disallowed_all": False, "path_denied": True}

    return {"disallowed_all": False, "path_denied": False}


# ---------------------------------------------------------------------------
# 3. 스크래핑 (Crawl4AI + Playwright)
# ---------------------------------------------------------------------------

_IMG_PATTERN = re.compile(r"!\[.*?\]\(.*?\)", re.DOTALL)


async def scrape_page(url: str) -> str:
    """
    Crawl4AI + Playwright(headless) 로 페이지를 스크래핑하고
    마크다운 텍스트를 반환한다. 이미지 구문은 후처리로 제거한다.
    """
    browser_cfg = BrowserConfig(headless=True, verbose=False)
    run_cfg = CrawlerRunConfig(
        word_count_threshold=10,
        verbose=False,
        # 이미지 태그 자체를 크롤러 레벨에서 제외
        excluded_tags=["img", "figure", "picture", "svg"],
    )

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url=url, config=run_cfg)

    if not result.success:
        raise RuntimeError(f"스크래핑 실패: {result.error_message or '알 수 없는 오류'}")

    # 마크다운 이미지 구문 후처리 제거
    content = result.markdown or ""
    content = _IMG_PATTERN.sub("", content)
    return content.strip()


# ---------------------------------------------------------------------------
# 4. 마크다운 저장
# ---------------------------------------------------------------------------

def _extract_host_label(url: str) -> str:
    """
    URL에서 저장용 호스트 레이블을 추출한다.
    www.naver.com → naver
    docs.python.org → python
    example.com    → example
    """
    hostname = urlparse(url).hostname or url
    parts = hostname.split(".")
    # TLD(.com/.org 등) 제거, 서브도메인(www 등) 제거
    if len(parts) >= 2:
        return parts[-2]   # second-level domain
    return parts[0]


def save_markdown(url: str, content: str) -> Tuple[Path, str]:
    """
    스크래핑한 내용을 마크다운 파일로 저장한다.
    저장 경로: /app/scraped_data/{host_label}/scrap_{host_label}_{NN}.md
    반환: (파일 경로, host_label)
    """
    host_label = _extract_host_label(url)
    base_dir = Path(os.getcwd()) / "scraped_data" / host_label
    base_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(base_dir.glob(f"scrap_{host_label}_*.md"))
    next_idx = 1
    if existing:
        last_stem = existing[-1].stem
        m = re.search(r"_(\d{2,})$", last_stem)
        if m:
            next_idx = int(m.group(1)) + 1

    filename = f"scrap_{host_label}_{next_idx:02d}.md"
    file_path = base_dir / filename
    file_path.write_text(content, encoding="utf-8")
    return file_path, host_label


# ---------------------------------------------------------------------------
# 5. 키워드 카운팅
# ---------------------------------------------------------------------------

def count_keywords(md_path: Path, keywords: List[str]) -> Dict[str, int]:
    """
    마크다운 파일에서 각 키워드의 출현 횟수를 카운팅한다 (대소문자 구분 없음).
    반환: {keyword: count}
    """
    text = md_path.read_text(encoding="utf-8")
    result: Dict[str, int] = {}
    for kw in keywords:
        if not kw.strip():
            result[kw] = 0
            continue
        pattern = re.compile(re.escape(kw.strip()), re.IGNORECASE)
        result[kw] = len(pattern.findall(text))
    return result
