"""
main.py — FastAPI Application Entry Point
웹 키워드 스크래퍼 백엔드 API
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from urllib.parse import urlparse

from app.scraper import (
    fetch_all_policy_files,
    parse_robots_for_path,
    scrape_page,
    save_markdown,
    count_keywords,
)

app = FastAPI(title="Web Keyword Scraper API", version="0.2.0")


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ScrapingRequest(BaseModel):
    url: str
    keywords: List[str]


class ScrapingResponse(BaseModel):
    status: str                          # "success" | "policy_denied" | "path_denied"
    domain: str                          # 도메인 주소 (에러 메시지 조합용)
    markdown_file: Optional[str] = None  # 저장된 마크다운 파일명
    markdown_content: Optional[str] = None  # 마크다운 파일 전체 내용
    keyword_counts: Optional[Dict[str, int]] = None  # {keyword: count}
    message: str                         # 사용자 표시 메시지


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {"status": "ok", "redis_url": os.getenv("REDIS_URL")}


@app.post("/api/scrape", response_model=ScrapingResponse)
async def submit_scrape(request: ScrapingRequest):
    raw_url = request.url.strip()
    keywords = [k.strip() for k in request.keywords if k.strip()]

    # --- URL 파싱 ---
    parsed = urlparse(raw_url)
    domain = parsed.netloc or parsed.path  # 도메인 추출
    url_path = parsed.path or "/"
    if parsed.query:
        url_path += f"?{parsed.query}"

    # --- 정책 파일 조회 ---
    policy_files = await fetch_all_policy_files(domain)

    # --- robots.txt 파싱 ---
    policy = parse_robots_for_path(policy_files["robots.txt"], url_path)

    if policy["disallowed_all"]:
        return ScrapingResponse(
            status="policy_denied",
            domain=domain,
            message=f"{domain}에서 해당 요청을 거부합니다.",
        )

    if policy["path_denied"]:
        return ScrapingResponse(
            status="path_denied",
            domain=domain,
            message=f"{domain}에서 해당 요청을 거부합니다.",
        )

    # --- 스크래핑 ---
    try:
        content = await scrape_page(raw_url)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"detail": f"스크래핑 중 오류가 발생했습니다: {str(exc)}"},
        )

    # --- 마크다운 저장 ---
    try:
        md_path, host_label = save_markdown(raw_url, content)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": f"파일 저장 중 오류가 발생했습니다: {str(exc)}"},
        )

    # --- 키워드 카운팅 ---
    kw_counts = count_keywords(md_path, keywords)

    return ScrapingResponse(
        status="success",
        domain=domain,
        markdown_file=md_path.name,
        markdown_content=content,
        keyword_counts=kw_counts,
        message="분석이 완료되었습니다.",
    )
