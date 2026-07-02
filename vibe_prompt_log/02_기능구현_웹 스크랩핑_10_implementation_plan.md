# robots.txt Compliance Implementation Plan

Ensure compliance with target domains' `robots.txt` rules before starting any scraping tasks. Disallow scraping when the target URL matches the `Disallow` rules in `robots.txt` for `User-agent: *`.

## Proposed Changes

### Backend Scraper & API

#### [MODIFY] [scraper.py](file:///d:/08_Technical_Test/backend/app/scraper.py)
- Implement custom `robots.txt` parsing and pattern matching for `User-agent: *` to support wildcard/regex-based path matching (like `*` and `$`).
- Check if `robots.txt` exists (returns HTTP 200). If not (e.g., 404 or other network errors), allow scraping.
- Check if any `Disallow` rules exist. If not, allow scraping.
- Check if all paths are blocked (`Disallow: *` or `Disallow: /`). If so, flag as `disallowed_all`.
- Check if the target URL path matches any `Disallow` path. If so, flag as `path_denied`.

#### [MODIFY] [main.py](file:///d:/08_Technical_Test/backend/app/main.py)
- Parse target URL with full path and query parameters (`parsed.path + ("?" + parsed.query if parsed.query else "")`).
- Return the message `"{domain}에서 해당 요청을 거부합니다."` for both `policy_denied` (`disallowed_all`) and `path_denied` status.

### Frontend App

#### [MODIFY] [App.tsx](file:///d:/08_Technical_Test/frontend/src/App.tsx)
- Ensure the URL input field is cleared and the exact error message from the backend is displayed to the user when blocked.

## Verification Plan

### Manual Verification
- Test with local test cases and mock `robots.txt` inputs.
- Test with the provided `robots.txt for https___www.saramin.co.kr_.txt` content.
- Ensure the URL is cleared from the input field, and the message `"(domain)에서 해당 요청을 거부합니다."` is correctly displayed when hitting blocked paths.
