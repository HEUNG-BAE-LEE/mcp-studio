// 카탈로그 FieldPair 절 — half(Field 안 아이디 + 비밀번호 Input 둘) · label(라벨 + 값 세 줄). 폭 전환으로 760 접힘을 본다
import { useState } from 'react';
import { Field, FieldPair, InlineCode, Input } from '../../ui';
import catalog from './catalog.module.css';
import styles from './FieldPairSection.module.css';

const SERVER_URL = 'http://127.0.0.1:8101/mcp';

export function FieldPairSection() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        칸 하나를 두 칸으로 나누는 격자다. half는 1 : 1, label은 라벨 120 + 남은 폭이고 줄마다 위 여백이 있다. 칸은 최소 폭 0으로 줄어든다.
        760 이하에서 half는 한 열(칸 사이 그대로), label은 라벨 위 · 값 아래다.
      </p>

      <h3 className={catalog.heading}>half — Field의 입력 열 안(두 입력은 각자 aria-label, Field 라벨은 첫 입력에 잇는다)</h3>
      <Field label="테스트 계정">
        {({ id }) => (
          <FieldPair variant="half">
            <Input id={id} aria-label="아이디" placeholder="아이디" value={account} onValueChange={setAccount} />
            <Input type="password" aria-label="비밀번호" placeholder="비밀번호" value={password} onValueChange={setPassword} />
          </FieldPair>
        )}
      </Field>

      <h3 className={catalog.heading}>label — 라벨 + 값 줄(값은 글 · InlineCode)</h3>
      <div>
        <FieldPair variant="label" label="MCP 서버 주소">
          <InlineCode>{SERVER_URL}</InlineCode>
        </FieldPair>
        <FieldPair variant="label" label="실행 방식">
          <span className={styles.value}>이 컴퓨터의 프로세스</span>
        </FieldPair>
        <FieldPair variant="label" label="전송 방식">
          <span className={styles.value}>Streamable HTTP, 액세스 키 인증</span>
        </FieldPair>
      </div>

      <h3 className={catalog.heading}>긴 값 — 칸 안에서 접힌다</h3>
      <FieldPair variant="label" label="긴 라벨이 들어와도 칸 안에서 접힙니다">
        <span className={styles.value}>https://example.internal/api/v1/very/long/path/that/keeps/going/and/going/without/a/break</span>
      </FieldPair>
    </div>
  );
}
