# apps/backend/app/ieum/recorder/scope.py
"""항상 차단하는 주소. 사람이 기록하는 동안 대상 밖으로 이동하는 것은 막지 않는다(대상 주소는 울타리가 아니라
기준점이다). 막는 것은 어떤 업무에서도 정당하게 갈 일이 없는 곳뿐이다: 서버 자신, 클라우드 메타데이터, 브라우저 내부 주소.

전제: 화면 중계에 주소창이 없다. 사람은 대상 화면이 제공하는 링크로만 이동한다. 주소창을 넣으면 이 판단을 다시 한다.
시연처럼 대상 자체가 localhost 면 그 출처의 업무 화면은 열어야 하므로, 서버 자신은 "대상 출처가 아닌 루프백"과
"같은 출처의 이음 콘솔 경로"로 판단한다.
"""
import ipaddress
from typing import List, Optional
from urllib.parse import urlsplit

DENY_SCHEMES = ("file", "chrome", "chrome-extension", "devtools", "view-source", "ftp")
DENY_HOSTS = {"metadata.google.internal", "metadata"}
DENY_NETS = [ipaddress.ip_network("169.254.0.0/16"), ipaddress.ip_network("fd00:ec2::254/128")]
CONSOLE_PATHS = ("/api/ieum/", "/ieum/")


def _ip(host: str):
    try:
        return ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return None


def blocked(url: str, target_origin: str, extra: Optional[List[str]] = None) -> Optional[str]:
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme in DENY_SCHEMES:
        return "브라우저 내부 주소"
    if scheme not in ("http", "https"):
        return None                                   # about:blank, data:, blob: 은 화면 안의 것이다
    host = (parts.hostname or "").lower()
    origin = f"{scheme}://{parts.netloc.lower()}"
    ip = _ip(host)
    nets, hosts = list(DENY_NETS), set(DENY_HOSTS)
    for e in extra or []:
        try:
            nets.append(ipaddress.ip_network(e, strict=False))
        except ValueError:
            hosts.add(e.lower())
    if host in hosts:
        return "차단 목록"
    if ip is not None and any(ip in n for n in nets if n.version == ip.version):
        return "클라우드 메타데이터·차단 대역"
    loopback = host == "localhost" or (ip is not None and ip.is_loopback)
    if loopback and origin != target_origin.lower():
        return "서버 자신"
    if loopback and parts.path.startswith(CONSOLE_PATHS):
        return "이음 콘솔"
    return None
