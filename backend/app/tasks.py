import taskiq_redis
import os

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
broker = taskiq_redis.ListQueueBroker(redis_url)

@broker.task
async def scrape_task(url: str, keyword: str) -> dict:
    # Task stub for crawler agent
    return {
        "url": url,
        "keyword": keyword,
        "found": False,
        "message": "Task queued successfully"
    }
