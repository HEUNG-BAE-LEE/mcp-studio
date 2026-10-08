// 카탈로그 GitFileList 절 — 단계 셋 + 파일 넷(메서드 없음 "*" · @Deprecated · 메모 · 긴 파일 이름) · 단계 없음(pending) · 파일 없음 · enterLast.
// 마지막 줄 등장 모션은 "파일 더하기"로 재현한다(새 줄만 한 번 떠오른다). 1100 한 열 접힘은 폭 전환으로 본다
import { useState } from 'react';
import { Box, Button, GitFileList, type GitFileItem, type GitStageItem } from '../../ui';
import catalog from './catalog.module.css';

const TITLE = 'Git 소스 분석';
const DESCRIPTION = 'git.example.com/purchase-app · Spring MVC';
const PENDING = '저장소를 읽는 중';

const STAGES: readonly GitStageItem[] = [
  { key: 'clone', title: '저장소 복제', detail: 'purchase-app, main 브랜치, 파일 412개' },
  { key: 'framework', title: '프레임워크 감지', detail: 'Spring MVC' },
  { key: 'mapper', title: '매퍼로 읽기, 쓰기 분류', detail: 'INSERT 6개, SELECT 24개, UPDATE 4개' },
];

const FILES: readonly GitFileItem[] = [
  {
    key: 'order',
    name: '…/OrderController.java',
    title: 'src/main/java/com/example/purchase/order/OrderController.java',
    apis: [
      { method: 'GET', path: '/api/orders' },
      { method: 'POST', path: '/api/orders' },
      { method: 'GET', path: '/api/orders/{id}' },
    ],
  },
  {
    key: 'legacy',
    name: '…/LegacyOrderController.java',
    title: 'src/main/java/com/example/purchase/legacy/LegacyOrderController.java',
    apis: [
      { method: '*', path: '/legacy/order.do', deprecated: true },
      { method: 'GET', path: '/legacy/order/list.do' },
    ],
    note: '화면 이동 매핑 2개 제외, @Deprecated 1개',
  },
  {
    key: 'vendor',
    name: '…/VendorController.java',
    title: 'src/main/java/com/example/purchase/vendor/VendorController.java',
    apis: [{ method: 'PUT', path: '/api/vendors/{vendorId}' }],
    note: '화면 이동 매핑 1개 제외',
  },
  {
    key: 'long',
    name: '…/PurchaseOrderApprovalWorkflowHistoryExportController.java',
    title: 'src/main/java/com/example/purchase/approval/PurchaseOrderApprovalWorkflowHistoryExportController.java',
    apis: [{ method: 'GET', path: '/api/approvals/history/export' }],
  },
];

/** "파일 더하기"가 돌려 쓰는 파일 줄 — 키는 더한 순서 번호를 붙여 새 줄로 만든다 */
const extraFile = (seq: number): GitFileItem => ({
  key: `extra-${seq}`,
  name: `…/Report${seq}Controller.java`,
  title: `src/main/java/com/example/purchase/report/Report${seq}Controller.java`,
  apis: [{ method: seq % 2 === 0 ? 'POST' : 'GET', path: `/api/reports/${seq}` }],
});

function EnterDemo() {
  const [files, setFiles] = useState<readonly GitFileItem[]>(FILES);
  const [enterLast, setEnterLast] = useState(true);
  const addFile = () => setFiles((current) => [...current, extraFile(current.length + 1)]);
  return (
    <div className={catalog.stack}>
      <p className={catalog.note}>
        파일 {files.length}줄 · enterLast {String(enterLast)}. 켜져 있으면 마지막 줄이 바탕 --surface-hover이고 처음 그려질 때 한 번 떠오른다 —
        같은 key의 줄은 다시 돌지 않는다. 끄면(탐색이 끝남) 표시가 없다.
      </p>
      <div className={catalog.row}>
        <Button size="sm" onClick={addFile}>
          파일 더하기
        </Button>
        <Button size="sm" aria-pressed={enterLast} onClick={() => setEnterLast((value) => !value)}>
          {enterLast ? 'enterLast 끄기' : 'enterLast 켜기'}
        </Button>
        <Button size="sm" onClick={() => setFiles(FILES)}>
          처음으로
        </Button>
      </div>
      <Box title={TITLE} description={DESCRIPTION} padded>
        <GitFileList stages={STAGES} pending={PENDING} files={files} enterLast={enterLast} />
      </Box>
    </div>
  );
}

export function GitFileListSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        끝난 단계(완료 원 20 · 굵은 서버 문장 · 흐린 보조) 아래 파일 줄(파일 칸 230 · API · 메모). 파일 칸은 code 아이콘 + 고정폭 말줄임이고 전체
        경로는 title 툴팁이다. 메서드가 없으면 쓰는 곳이 "*"를 넘기고, 사용 중단 API는 경로 뒤에 @Deprecated가 붙는다. 1100에서 파일 줄이 한 열이다.
      </p>
      <h3 className={catalog.heading}>단계 셋 + 파일 넷</h3>
      <Box title={TITLE} description={DESCRIPTION} padded>
        <GitFileList stages={STAGES} pending={PENDING} files={FILES} />
      </Box>
      <h3 className={catalog.heading}>단계 없음(pending) · 파일 없음</h3>
      <Box title={TITLE} description={DESCRIPTION} padded>
        <GitFileList stages={[]} pending={PENDING} files={[]} />
      </Box>
      <h3 className={catalog.heading}>파일 없음(단계만)</h3>
      <Box title={TITLE} description={DESCRIPTION} padded>
        <GitFileList stages={STAGES} pending={PENDING} files={[]} />
      </Box>
      <h3 className={catalog.heading}>enterLast — 마지막 줄 등장 모션</h3>
      <EnterDemo />
    </div>
  );
}
