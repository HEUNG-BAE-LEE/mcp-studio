// 카탈로그 Notice 절 — tone 넷(info · warn · danger · mute) × 기본 아이콘 · 자리별 아이콘 · 오른쪽 버튼 · 굵은 글 · 빈 문장 · 긴 낱말. 문구는 이음 자리 예시
import { Button, Notice } from '../../ui';
import catalog from './catalog.module.css';

export function NoticeSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        아이콘 + 문장 + 오른쪽 버튼(있는 자리만). 아이콘을 생략하면 info · mute는 info, warn · danger는 alert다. role이 없는 그
        자리의 글이고, 굵은 글(&lt;b&gt;)은 본문 색이다. 상태는 없다(버튼이 낸다).
      </p>

      <h3 className={catalog.heading}>tone — 기본 아이콘</h3>
      <div className={catalog.stack}>
        <Notice>
          원본 시스템의 <b>OpenAPI 명세 주소</b>를 넣으면 이음이 도구 후보를 만듭니다.
        </Notice>
        <Notice tone="warn">원본 시스템에 연결하지 못했습니다. 인증 정보를 확인해 주세요.</Notice>
        <Notice tone="danger">원본 시스템이 500 응답을 돌려줬습니다.</Notice>
        <Notice tone="mute">이 도구는 아직 공개하지 않았습니다.</Notice>
      </div>

      <h3 className={catalog.heading}>자리별 아이콘 · 오른쪽 버튼</h3>
      <div className={catalog.stack}>
        <Notice icon="lock" action={<Button size="sm">인증 정보 입력</Button>}>
          이 원본 시스템은 <b>API 키</b>가 필요합니다.
        </Notice>
        <Notice tone="warn" icon="shield" action={<Button size="sm">다시 분석</Button>}>
          원본 명세가 바뀌었습니다. 바뀐 필드를 검토해 주세요.
        </Notice>
        <Notice tone="mute" icon="search">
          소스 코드 근거는 Git 저장소를 연결하면 함께 찾습니다.
        </Notice>
      </div>

      <h3 className={catalog.heading}>빈 문장(실패 단계의 빈 서버 문장) · 긴 낱말</h3>
      <div className={catalog.stack}>
        <Notice tone="warn" icon="alert">
          {''}
        </Notice>
        <Notice tone="danger">
          https://example.internal/api/v1/very/long/path/that/does/not/break/naturally/and/wraps/by/word/only?query=1
        </Notice>
      </div>
    </div>
  );
}
