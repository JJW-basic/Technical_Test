"""
tasks.py — Taskiq Broker & Task Definitions
브로커: taskiq_redis.RedisBroker (단일 큐, 지연 초기화로 BLPOP 타임아웃 방지)
"""

import logging
import os

from taskiq_redis import ListQueueBroker

logger = logging.getLogger("taskiq")
logger.setLevel(logging.INFO)

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
broker = ListQueueBroker(
    redis_url,
    socket_timeout=None,
)


@broker.task
async def scrape_task(url: str, keyword: str) -> dict:
    logger.info("▶️ scrape_task started – url=%s, keyword=%s", url, keyword)
    return {
        "url": url,
        "keyword": keyword,
        "found": False,
        "message": "Task queued successfully",
    }
