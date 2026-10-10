# apps/backend/app/ieum/recorder/login.py
"""기록 세션의 로그인. 서비스 계정이 있으면 자동으로 하고, 안 되면 사람이 중계 화면에서 직접 한다.

레시피(필드 이름)는 둘 다 남긴다. 계정 값을 알면 로그인 요청에서 값으로 필드를 찾고(capture.build_recipe), 사람이 직접
로그인해 값을 모르면 로그인 화면 HTML 에서 필드를 읽는다(session_auth.discover_recipe). 비밀번호 값은 넣지 않는다.
"""
import asyncio
from typing import Optional
from urllib.parse import urlsplit

from app.ieum.discovery import capture
from app.ieum.discovery.policy import Policy
from app.ieum.gateway import session_auth


async def _find_password(page):
    for frame in page.frames:
        try:
            loc = frame.locator("input[type=password]:visible")
            if await loc.count() > 0:
                return loc.first
        except Exception:
            continue
    return None


async def on_login_page(page) -> bool:
    return await _find_password(page) is not None


async def auto_login(page, creds: dict) -> bool:
    """크롤러 _login(crawler.py:461-501) 과 같은 순서를 비동기로 한다."""
    user, pw = creds.get("username", ""), creds.get("password", "")
    pwd = await _find_password(page)
    if not (user and pw and pwd):
        return False
    form = pwd.locator("xpath=ancestor::form[1]")
    scope = form if await form.count() > 0 else page
    uid = scope.locator("input:not([type]), input[type=text], input[type=email], input[type=tel]").locator("visible=true").first
    try:
        await uid.fill(user, timeout=5000)
        await pwd.fill(pw, timeout=5000)
        submit = scope.locator("button[type=submit], input[type=submit], input[type=image]").first
        if await submit.count():
            await submit.click(timeout=4000)
        else:
            await pwd.press("Enter")
        await page.wait_for_load_state("domcontentloaded", timeout=15_000)
        await page.wait_for_timeout(600)
    except Exception:
        return False
    return not await on_login_page(page)


async def recipe_for(login_req: Optional[dict], policy: Policy, creds: Optional[dict]) -> Optional[dict]:
    if not login_req:
        return None
    if creds and creds.get("username") and creds.get("password"):
        _, recipe = capture.build_recipe(login_req, login_req.get("page") or "", creds["username"], creds["password"])
        return capture.recipe_rel(policy, recipe) if recipe else None
    page_url = login_req.get("page") or ""
    if not page_url:
        return None

    def rel(u: str) -> str:
        return policy.rel(urlsplit(u).path) if policy.same_origin(u) else u
    try:
        return await asyncio.to_thread(session_auth.discover_recipe, page_url, rel)
    except Exception:
        return None
