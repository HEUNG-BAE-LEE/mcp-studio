# apps/backend/app/ieum/recorder/scope.py
"""항상 차단하는 주소. 사람이 기록하는 동안 대상 밖으로 이동하는 것은 막지 않는다(대상 주소는 울타리가 아니라
기준점이다). 막는 것은 어떤 업무에서도 정당하게 갈 일이 없는 곳뿐이다: 서버 자신, 클라우드 메타데이터, 브라우저 내부 주소.

전제: 화면 중계에 주소창이 없다. 사람은 대상 화면이 제공하는 링크로만 이동한다. 주소창을 넣으면 이 판단을 다시 한다.
시연처럼 대상 자체가 localhost 면 그 출처의 업무 화면은 열어야 하므로, 서버 자신은 "대상 출처가 아닌 루프백"과
"같은 출처의 이음 콘솔 경로"로 판단한다.

주소 표기는 정규화한 뒤 본다: 끝의 점(localhost.), *.localhost, IPv4 매핑 IPv6([::ffff:127.0.0.1]), 미지정 주소(0.0.0.0, ::)는
모두 같은 루프백·메타데이터로 취급한다. 판단할 수 없는 포트·주소는 막는다.
"""
import ipaddress
from typing import List, Optional
from urllib.parse import urlsplit

DENY_SCHEMES = ("file", "chrome", "chrome-extension", "devtools", "view-source", "ftp")
DENY_HOSTS = {"metadata.google.internal", "metadata"}
DENY_NETS = [ipaddress.ip_network("169.254.0.0/16"), ipaddress.ip_network("fd00:ec2::254/128")]
CONSOLE_PATHS = ("/api/ieum/", "/ieum/")
DEFAULT_PORT = {"http": 80, "https": 443}


def _norm_host(host: str) -> str:
    return (host or "").lower().strip("[]").rstrip(".")


def _ip(host: str):
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return None
    if ip.version == 6 and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def _key(scheme: str, host: str, port: Optional[int]) -> tuple:
    """출처 비교용 열쇠. 호스트는 정규화한 표기, 포트는 기본 포트를 채운 값이다."""
    ip = _ip(host)
    return (scheme, str(ip) if ip is not None else host, port if port is not None else DEFAULT_PORT.get(scheme))


def blocked(url: str, target_origin: str, extra: Optional[List[str]] = None) -> Optional[str]:
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme in DENY_SCHEMES:
        return "브라우저 내부 주소"
    if scheme not in ("http", "https"):
        return None                                   # about:blank, data:, blob: 은 화면 안의 것이다
    try:
        port = parts.port
    except ValueError:
        return "잘못된 주소"
    host = _norm_host(parts.hostname or "")
    ip = _ip(host)
    nets, hosts = list(DENY_NETS), set(DENY_HOSTS)
    for e in extra or []:
        try:
            nets.append(ipaddress.ip_network(e, strict=False))
        except ValueError:
            hosts.add(_norm_host(e))
    if host in hosts:
        return "차단 목록"
    if ip is not None and any(ip in n for n in nets if n.version == ip.version):
        return "클라우드 메타데이터·차단 대역"
    loopback = host == "localhost" or host.endswith(".localhost") or (
        ip is not None and (ip.is_loopback or ip.is_unspecified))
    if loopback:
        tparts = urlsplit(target_origin)
        target = _key(tparts.scheme.lower(), _norm_host(tparts.hostname or ""), tparts.port)
        if _key(scheme, host, port) != target:
            return "서버 자신"
        if parts.path.lower().startswith(CONSOLE_PATHS):
            return "이음 콘솔"
    return None
