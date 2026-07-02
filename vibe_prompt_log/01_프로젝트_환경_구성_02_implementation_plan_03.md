# Taskiq Worker Startup Syntax Optimization Plan

We have analyzed the warning `No module named 'app.main:app'` printed in the worker log. 

## Root Cause Analysis

- **Taskiq Command Syntax**:
  The command `taskiq worker app.tasks:broker app.main:app` uses `app.main:app` to import tasks. Taskiq imports tasks from modules listed after the broker. However, taskiq expects module import paths (e.g. `app.main`) instead of python object formats (e.g. `app.main:app`). Passing `app.main:app` causes python to search for a package literally named `app.main:app` which fails.

---

## Proposed Changes

### Root Orchestration

#### [MODIFY] [docker-compose.yml](file:///d:/08_Technical_Test/docker-compose.yml)
Update the worker service command parameters to pass the correct module import path `app.main`.
```diff
-    command: taskiq worker app.tasks:broker app.main:app
+    command: taskiq worker app.tasks:broker app.main
```

---

## Verification Plan

### Automated Tests
- Command: `docker compose up -d worker`
- Log check: `docker logs 08_technical_test-worker-1` (expecting `Importing tasks from module app.main` without `ModuleNotFoundError` warning/crash).

### Manual Verification
- Access `http://localhost/` (expecting frontend view loading successfully).
- Access `http://localhost/api/health` (expecting status JSON output).
