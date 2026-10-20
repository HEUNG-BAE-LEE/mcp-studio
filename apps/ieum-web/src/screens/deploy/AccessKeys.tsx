// 액세스 키 — 소절 제목 "액세스 키" + 오른쪽 "키 발급"(key) + 표 여섯 칸(이름 · 키 · 발급일 · 마지막 사용 · 상태 · 폐기)(옛 keysBox — js/menu/deploy.js:45-50)
// 묶음이 없는 빈 상태에서도 그린다(옛 :52). 키는 가린 값(고정폭), 날짜는 서버가 만든 글 그대로(흐림). 상태 칩 사용 중 · 폐기됨(copy/status key),
// "폐기"는 사용 중인 키에만. 키가 없으면 여섯 칸을 합친 한 칸에 문장(옛 그대로 — 빈 상태 부품이 아니다).
// 키 · 발급일 · 마지막 사용이 비어 오면 값 없음 표기(옛은 "null" 글자 :48 — 서버 routers/deploy.py는 늘 채운다).
// 키 목록은 영역 조회다 — 첫 로딩은 상자를 비우고 aria-busy, 첫 실패는 상자 안 원문(머리 없음 · 경고). 화면에 들어올 때마다 받는다(이식 기간 허용 차이)
import { useAccessKeys } from '../../api/hooks/useAccessKeys';
import type { AccessKey } from '../../api/types';
import { openKeyIssue, openKeyRevoke } from '../../app/layers';
import { regionGate } from '../../app/screenGate';
import { DEPLOY } from '../../copy/deploy';
import { NONE } from '../../copy/format';
import { statusOf } from '../../copy/status';
import {
  Button,
  CompactTable,
  CompactTableCell,
  CompactTableHeadCell,
  CompactTableRow,
  ScreenState,
  SectionTitle,
  StatusChip,
} from '@/ui';
import styles from './DeployScreen.module.css';

const K = DEPLOY.keys;
const COLUMN_COUNT = 6;

function KeyRow({ row }: Readonly<{ row: AccessKey }>) {
  const { label, tone } = statusOf('key', row.on ? 'on' : 'off');
  return (
    <CompactTableRow>
      <CompactTableCell>{row.name}</CompactTableCell>
      {/* 글자 크기 · 글꼴은 칸에 — 옛 td.key(칸 자체가 12.5px 고정폭이라 이웃 칸과 위가 맞는다) */}
      <CompactTableCell className={styles.key}>{row.key ?? NONE}</CompactTableCell>
      <CompactTableCell className={styles.description}>{row.created ?? NONE}</CompactTableCell>
      <CompactTableCell className={styles.description}>{row.last ?? NONE}</CompactTableCell>
      <CompactTableCell>
        <StatusChip tone={tone}>{label}</StatusChip>
      </CompactTableCell>
      <CompactTableCell>
        {row.on ? (
          <Button size="sm" onClick={() => openKeyRevoke(row.id)}>
            {K.revoke}
          </Button>
        ) : null}
      </CompactTableCell>
    </CompactTableRow>
  );
}

function KeysTable({ accessKeys }: Readonly<{ accessKeys: readonly AccessKey[] }>) {
  return (
    <CompactTable
      minWidth={560}
      head={
        <>
          <CompactTableHeadCell>{K.columns.name}</CompactTableHeadCell>
          <CompactTableHeadCell>{K.columns.key}</CompactTableHeadCell>
          <CompactTableHeadCell>{K.columns.created}</CompactTableHeadCell>
          <CompactTableHeadCell>{K.columns.last}</CompactTableHeadCell>
          <CompactTableHeadCell>{K.columns.status}</CompactTableHeadCell>
          <CompactTableHeadCell />
        </>
      }
    >
      {accessKeys.length === 0 ? (
        <CompactTableRow>
          <CompactTableCell colSpan={COLUMN_COUNT}>{K.empty}</CompactTableCell>
        </CompactTableRow>
      ) : (
        accessKeys.map((k) => <KeyRow key={k.id} row={k} />)
      )}
    </CompactTable>
  );
}

export function AccessKeys() {
  const gate = regionGate(useAccessKeys());
  return (
    <div>
      <SectionTitle
        level="sub"
        title={K.title}
        actions={
          <Button size="sm" icon="key" onClick={openKeyIssue}>
            {K.issue}
          </Button>
        }
      />
      <ScreenState gate={gate} scope="region">
        {(accessKeys) => <KeysTable accessKeys={accessKeys} />}
      </ScreenState>
    </div>
  );
}
