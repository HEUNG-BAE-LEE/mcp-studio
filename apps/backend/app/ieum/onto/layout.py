"""그래프 배치: 아직 자리가 없는 객체에 좌표를 준다. 좌표는 화면 SVG 의 사용자 좌표(노드 중심)이다.

처음 만드는 온톨로지는 연결이 가장 많은 객체를 가운데 두고, 이미 자리가 있는 온톨로지에 객체가 더해지면 링크로 이어진 객체 가까이에 빈 자리를 고른다.
사용자가 끌어서 옮기는 기능은 없고(목업에도 없다) 좌표는 저장해서 다시 열어도 같은 모양이다.
"""
import math
from typing import Dict, List, Tuple

# 자리 후보: 중앙(허브) 먼저, 다음은 주변. 노드 폭(180~250)과 줄 간격(약 130)이 겹치지 않게 잡았다.
SLOTS: List[Tuple[int, int]] = [
    (430, 190), (130, 70), (720, 70), (940, 70), (200, 330), (850, 190), (560, 330), (850, 330), (130, 190), (-140, 190), (430, 460), (720, 460),
    (1180, 190), (1180, 70), (1180, 330), (-140, 70), (-140, 330), (130, 460), (940, 460), (-140, 460), (1180, 460),
]
_GRID_X = (-140, 130, 430, 720, 940, 1180)


def _slots() -> List[Tuple[int, int]]:
    out = list(SLOTS)
    for y in range(590, 1300, 130):
        out.extend((x, y) for x in _GRID_X)
    return out


def place(objs: List[dict], links: List[dict]) -> int:
    """pos 가 없는 객체(objs 의 항목)에 pos 를 채운다. 채운 개수를 돌려준다."""
    todo = [o for o in objs if not o.get("pos")]
    if not todo:
        return 0
    ids = {o["id"] for o in objs}
    adj: Dict[str, set] = {i: set() for i in ids}
    for l in links:
        if l["from"] in ids and l["to"] in ids:
            adj[l["from"]].add(l["to"])
            adj[l["to"]].add(l["from"])
    pos = {o["id"]: tuple(o["pos"]) for o in objs if o.get("pos")}
    used = set(pos.values())
    free = [s for s in _slots() if s not in used]
    todo.sort(key=lambda o: (-len(adj[o["id"]]), -(o.get("rows") or 0), o["id"]))
    placed = 0
    for o in todo:
        if not free:
            o["pos"] = [130, 600 + 130 * placed]
            placed += 1
            continue
        near = [pos[n] for n in adj[o["id"]] if n in pos]
        if not near:
            near = list(pos.values())
        if near:
            cx, cy = sum(x for x, _ in near) / len(near), sum(y for _, y in near) / len(near)
            best = min(free, key=lambda s: (sum(math.hypot(s[0] - x, s[1] - y) for x, y in near) if adj[o["id"]] else math.hypot(s[0] - cx, s[1] - cy), SLOTS.index(s) if s in SLOTS else 99))
        else:
            best = free[0]
        free.remove(best)
        pos[o["id"]] = best
        o["pos"] = list(best)
        placed += 1
    return placed
