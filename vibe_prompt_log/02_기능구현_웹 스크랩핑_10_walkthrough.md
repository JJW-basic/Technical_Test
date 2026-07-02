# Walkthrough: robots.txt Compliance Logic

Implemented domain-level and path-level `robots.txt` check to comply with target domains' scrapability/crawlabity rules. If the target URL path matches a `Disallow` rule, scraping is blocked, and the URL input is cleared with an error notification.

## Changes Made

### Backend

1. **[scraper.py](file:///d:/08_Technical_Test/backend/app/scraper.py)**
   - Updated `fetch_robots_content` to verify the existence of `robots.txt` (via HTTP 200). If it fails or does not exist (404), scraping proceeds.
   - Replaced standard `urllib.robotparser` with a robust custom robots.txt parser and path matcher that handles wildcards (`*`) and exact end matches (`$`) under `User-agent: *`.
   - Returns whether all paths are disallowed (`disallowed_all`) or a specific path is disallowed (`path_denied`).

2. **[main.py](file:///d:/08_Technical_Test/backend/app/main.py)**
   - Parsed target URLs including query parameters (since some `robots.txt` rules restrict specific parameters).
   - Standardized the response message to `"{domain}에서 해당 요청을 거부합니다."` for both global blocks and path-specific blocks.

### Frontend

1. **[App.tsx](file:///d:/08_Technical_Test/frontend/src/App.tsx)**
   - Clears the URL input field and displays the exact rejection message when the backend returns a policy violation status.

---

## Verification & Screenshots

### 1. Backend Custom Parser Tests
We ran unit tests testing both allowed and disallowed cases against the provided `robots.txt` for `www.saramin.co.kr`:

```
Running robots.txt parser tests...

Path: /zf_user/jobs/recent-contents/company                        | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/auth                                                | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/talent/search                                       | Expected: (False, True) | Got: (False, True) | PASS
Path: /Click123                                                    | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/recruit/view/123                                    | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/recruit-apply/apply-info-read/abc                   | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/talent/browse-resume                                | Expected: (False, False) | Got: (False, False) | PASS
Path: /zf_user/jobs/view/popup                                     | Expected: (False, False) | Got: (False, False) | PASS
Path: /zf_user/jobs/relay/recruit-view                             | Expected: (False, False) | Got: (False, False) | PASS
Path: /                                                            | Expected: (False, False) | Got: (False, False) | PASS
Path: /Click                                                       | Expected: (False, True) | Got: (False, True) | PASS
Path: /Click/here                                                  | Expected: (False, True) | Got: (False, True) | PASS
Path: /zf_user/jobs/view?innerCampaign=headhuntingView             | Expected: (False, True) | Got: (False, True) | PASS
Disallowed all check: PASS
Non-existent robots.txt check: PASS

All tests PASSED! ✅
```

### 2. UI Rejection Verification
Screenshot capturing the state of the UI when a disallowed URL (`https://www.saramin.co.kr/zf_user/auth`) was requested:

![UI Rejection Screenshot](/C:/Users/test/.gemini/antigravity-ide/brain/66dc3fb5-bad9-4fa8-ae91-c8a7ad2a9144/after_wait_disallowed_1783012541559.png)

A video recording of the browser subagent interaction is available here:
![UI Rejection Flow Animation](/C:/Users/test/.gemini/antigravity-ide/brain/66dc3fb5-bad9-4fa8-ae91-c8a7ad2a9144/robots_ui_validation_1783012461573.webp)
