// 카탈로그 EvidenceBadge 절 — kind 둘(code · traffic) × on 둘(true · false), 결과 표 근거 칸의 네 경우(둘 다 · 소스만 · 트래픽만 · 범위 밖)
import { EvidenceBadge, type EvidenceKind } from '../../ui';
import catalog from './catalog.module.css';

const KINDS: readonly { kind: EvidenceKind; label: string; note: string }[] = [
  { kind: 'code', label: '소스', note: 'Git 소스 — --evidence-code' },
  { kind: 'traffic', label: '트래픽', note: '운영 트래픽 — --evidence-traffic' },
];

const CELLS: readonly { title: string; code: boolean; traffic: boolean }[] = [
  { title: '둘 다', code: true, traffic: true },
  { title: '소스만', code: true, traffic: false },
  { title: '트래픽만', code: false, traffic: true },
  { title: '범위 밖(근거 없음)', code: false, traffic: false },
];

export function EvidenceBadgeSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        탐색 근거 표지. 근거가 있으면 도메인 색(--evidence-*)이고, 없으면 점선 + 취소선의 "없음" 모양(Tag mute off)이다. 높이 20은 Tag md와
        같고 양옆에 2px 바깥 여백이 있다. 뜻은 글자가 전한다 — 꺼진 표지도 글자는 그대로 읽힌다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">kind</th>
              <th scope="col">on=true</th>
              <th scope="col">on=false</th>
              <th scope="col">뜻</th>
            </tr>
          </thead>
          <tbody>
            {KINDS.map(({ kind, label, note }) => (
              <tr key={kind}>
                <th scope="row">{kind}</th>
                <td>
                  <EvidenceBadge kind={kind} on>
                    {label}
                  </EvidenceBadge>
                </td>
                <td>
                  <EvidenceBadge kind={kind} on={false}>
                    {label}
                  </EvidenceBadge>
                </td>
                <td>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={catalog.heading}>결과 표 근거 칸 — 소스 + 트래픽 짝</h3>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">경우</th>
              <th scope="col">근거 칸</th>
            </tr>
          </thead>
          <tbody>
            {CELLS.map(({ title, code, traffic }) => (
              <tr key={title}>
                <th scope="row">{title}</th>
                <td>
                  <EvidenceBadge kind="code" on={code}>
                    소스
                  </EvidenceBadge>
                  <EvidenceBadge kind="traffic" on={traffic}>
                    트래픽
                  </EvidenceBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
