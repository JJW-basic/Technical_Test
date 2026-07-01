from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import os

app = FastAPI(title="Web Keyword Scraper API", version="0.1.0")

class ScrapingRequest(BaseModel):
    url: HttpUrl
    keywords: List[str]

class ScrapingResult(BaseModel):
    url: str
    keyword: str
    found: bool
    details: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "redis_url": os.getenv("REDIS_URL")}

@app.post("/api/scrape", response_model=List[ScrapingResult])
async def submit_scrape(request: ScrapingRequest):
    # Dummy sync response for initialization check
    results = []
    for keyword in request.keywords:
        results.append(
            ScrapingResult(
                url=str(request.url),
                keyword=keyword,
                found=False,
                details="Scraping environment initialized. Task worker integration is ready."
            )
        )
    return results
