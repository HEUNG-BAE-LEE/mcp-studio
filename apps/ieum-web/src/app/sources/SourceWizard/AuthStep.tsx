// AuthStep — 3단계 인증(옛 wzBody step 3 — js/menu/sources.js:71): 공용 인증 칸 + 자물쇠 안내 상자
// 인증 방식은 3단계로 들어갈 때 이미 이 모드의 선택지로 맞춰져 있다(wizardState toNextStep). 이 단계는 검증하지 않는다 —
// 빈 키는 서버가 거절하고 그 문장이 4단계 실패 상자에 나온다(옛 그대로)
import type { SourceCred } from '../../../api/types';
import { SOURCES } from '../../../copy/sources';
import { Notice } from '@/ui';
import { AuthForm } from '../AuthForm';
import styles from './AuthStep.module.css';

export type AuthStepProps = Readonly<{
  mode: string;
  cred: SourceCred;
  onChange: (cred: SourceCred) => void;
}>;

export function AuthStep({ mode, cred, onChange }: AuthStepProps) {
  return (
    <>
      <AuthForm mode={mode} cred={cred} onChange={onChange} />
      <Notice icon="lock" className={styles.notice}>
        {SOURCES.auth.noticePre}
        <b>{SOURCES.auth.noticeStrong}</b>
        {SOURCES.auth.noticePost}
      </Notice>
    </>
  );
}
