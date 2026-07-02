# Implementation Plan — Resolving Taskiq Redis Worker Crash Loop

## Problem Description
The Taskiq worker container is currently encountering a crash loop. In the worker logs, we see:
`redis.exceptions.TimeoutError: Timeout reading from redis:6379`
followed by the worker process exiting and the process manager reloading it every 60 seconds.

This happens because the `ListQueueBroker` uses `BRPOP` (blocking list pop) to block indefinitely while waiting for tasks from Redis. However, the default client-side `socket_timeout` configured in `redis-py` (asyncio) is `5` seconds. When no tasks are sent to the queue, the client-side socket times out, raising a `TimeoutError`. Since the `ListQueueBroker.listen()` loop only catches `ConnectionError` (not `TimeoutError`), the exception propagates and crashes the worker.

## Proposed Changes

### Backend Component

#### [MODIFY] [tasks.py](file:///d:/08_Technical_Test/backend/app/tasks.py)
We will modify the broker instantiation in `tasks.py` to explicitly pass `socket_timeout=None`. This tells the underlying connection pool not to set a read timeout on the socket, allowing blocking operations like `BRPOP` to wait indefinitely without raising `TimeoutError`.

```diff
-broker = ListQueueBroker(redis_url)
+broker = ListQueueBroker(
+    redis_url,
+    socket_timeout=None,
+)
```

## Verification Plan

### Manual Verification
1. Apply the change to `backend/app/tasks.py`.
2. Re-create and restart the docker containers:
   `docker compose down && docker compose up -d --build`
3. Monitor the worker logs for at least 2 minutes to confirm that the crash loop has stopped and the worker remains healthy (`Up` state):
   `docker compose logs -f worker`
