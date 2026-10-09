// 카탈로그 Notice 절 — tone 넷(info · warn · danger · mute) × 기본 아이콘 · 자리별 아이콘 · 오른쪽 버튼 · 굵은 글 · 빈 문장 · 긴 낱말,
// 진행 안내(spinner) · 여러 줄 서버 문장(preserveLines) · 서버 상태 알림 조합 · 한 줄 상태 줄(variant line + 끝 글 trailing). 문구는 이음 자리 예시
import { Button, Notice } from '../../ui';
import catalog from './catalog.module.css';

// 서버가 준 여러 줄 원문 — 서버 시작 실패 문장 + 로그 꼬리 모양
const SERVER_MESSAGE = `서버 프로세스가 시작 직후 종료됐습니다. (exit code 1)
  File "runtime/server.py", line 41, in main
    manifest = load_manifest(path)
FileNotFoundError: manifest.json`;

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

      <h3 className={catalog.heading}>spinner — 진행 안내(icon과 함께 쓰지 않는다)</h3>
      <div className={catalog.stack}>
        <Notice spinner>
          변경한 도구를 저장하고 서버를 배포하는 중입니다. 처음 띄울 때는 10초 가까이 걸릴 수 있습니다.
        </Notice>
      </div>

      <h3 className={catalog.heading}>preserveLines — 서버 문장의 줄바꿈 · 서버 상태 알림 조합</h3>
      <div className={catalog.stack}>
        <p className={catalog.note}>끔(기본) — 줄바꿈 · 이어진 공백이 한 줄로 접힌다</p>
        <Notice tone="danger" action={<Button size="sm" variant="primary">다시 시작</Button>}>
          <b>서버가 종료됐습니다.</b> {SERVER_MESSAGE}
        </Notice>
        <p className={catalog.note}>켬 — 서버가 준 줄을 그대로 보인다(긴 낱말은 여전히 접힌다)</p>
        <Notice tone="danger" preserveLines action={<Button size="sm" variant="primary">다시 시작</Button>}>
          <b>서버가 종료됐습니다.</b> {SERVER_MESSAGE}
        </Notice>
        <Notice
          tone="mute"
          preserveLines
          action={
            <Button size="sm" variant="primary" icon="play">
              시작
            </Button>
          }
        >
          <b>서버가 내려가 있습니다.</b> 마지막으로 배포한 버전 그대로 다시 띄울 수 있습니다. 그동안 AI는 이 묶음의 도구를 쓸 수
          없습니다.
        </Notice>
        <Notice icon="refresh">서버를 시작하는 중입니다. 잠시 뒤 주소가 열립니다.</Notice>
      </div>

      <h3 className={catalog.heading}>variant line — 한 줄 상태 줄(spinner · 아이콘 + 문장 + 오른쪽 끝 글 trailing, 완료 체크만 iconStroke bold)</h3>
      <div className={catalog.stack}>
        <Notice variant="line" spinner trailing="경과 02:14">
          /po/poList.do 화면에서 조회 버튼을 누르는 중
        </Notice>
        <Notice variant="line" icon="history" trailing="경과 00:00">
          오늘 21:30에 시작합니다
        </Notice>
        <Notice variant="line" icon="check" iconStroke="bold" trailing="경과 03:41">
          탐색을 마쳤습니다
        </Notice>
        <Notice variant="line" spinner trailing="경과 12:08">
          좁은 폭에서는 문장이 접히고 끝 글은 오른쪽에 남습니다 — 구매관리 발주 목록 화면의 상세 조회 요청을 기록하는 중
        </Notice>
      </div>
    </div>
  );
}
