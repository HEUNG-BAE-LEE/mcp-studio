// AuthForm — 인증 방식 고르기 + 방식별 칸. 연결 마법사 3단계와 재인증 모달이 함께 쓴다(옛 authFormHTML — js/menu/sources.js:85-96)
//
// ── 쓰는 곳 계약 ──
// props
//   mode — 원본 연결 방식(마법사는 고른 모드, 재인증은 원본의 proto). 선택지 · 칸 글자를 정한다(authOptions)
//   cred — 지금 인증 값. cred.type은 그 모드의 선택지 안이어야 한다 — 쓰는 곳이 시작할 때 coerceAuthType으로 맞춘다
//          (마법사는 3단계로 들어갈 때, 재인증은 모달을 열 때 — authOptions 머리). 이 부품은 값을 스스로 바꾸지 않는다
//   onChange(next) — 칸을 고칠 때마다 새 인증 값 전체(받은 값은 고치지 않는다)
// 동작(옛 그대로)
//   - 방식을 바꿔도 다른 방식의 칸 값은 지우지 않는다 — 서버가 type에 맞는 칸만 읽는다(옛 :188)
//   - API Key 전달 위치를 바꾸면 이름이 비었거나 기본 이름일 때만 새 위치의 기본 이름으로(옛 :189 — changeKeyLocation)
//   - 공공데이터(gov)는 전달 위치 · 이름 칸 없이 "서비스키" 한 칸(서버가 query serviceKey로 넣는다)
//   - 비밀 칸(키 · 토큰 · 비밀번호 · Client Secret)은 Input type="password"(부품이 autocomplete="new-password"를 넣는다)
// 그리기: Field 묶음(Fragment) — 첫 칸이 인증 방식 select다. 재인증 Modal의 첫 포커스는 select를 건너뛰고 첫 input으로 간다(Modal 계약).
//   어느 층(드로어 · 모달)인지 모르고 바깥 여백도 두지 않는다. Enter로 아무것도 보내지 않는다(form이 아니다)
import type { SourceCred } from '../../api/types';
import { SOURCES } from '../../copy/sources';
import { Field, Input, Select } from '@/ui';
import {
  authOptionsOf,
  changeKeyLocation,
  KEY_HEADER_DEFAULT,
  keyLocationOf,
} from './authOptions';

export type AuthFormProps = Readonly<{
  /** 원본 연결 방식 — 마법사의 모드 · 재인증 원본의 proto */
  mode: string;
  /** 지금 인증 값 — type은 그 모드의 선택지 안(쓰는 곳이 coerceAuthType으로 맞춘다) */
  cred: SourceCred;
  /** 새 인증 값 전체 */
  onChange: (next: SourceCred) => void;
}>;

/** 글자 칸 하나로 고치는 인증 값의 키 */
type CredTextKey = 'name' | 'key' | 'username' | 'password' | 'tokenUrl' | 'clientId' | 'clientSecret';

type CredInputProps = Readonly<{
  field: CredTextKey;
  label: string;
  cred: SourceCred;
  onChange: (next: SourceCred) => void;
  secret?: boolean;
  mono?: boolean;
  placeholder?: string;
}>;

/** 인증 값 한 칸(옛 authFormHTML 안의 f() — js/menu/sources.js:88) */
function CredInput({ field, label, cred, onChange, secret = false, mono = false, placeholder }: CredInputProps) {
  return (
    <Field label={label}>
      {({ id }) => (
        <Input
          id={id}
          type={secret ? 'password' : 'text'}
          mono={mono}
          placeholder={placeholder}
          value={cred[field] ?? ''}
          onValueChange={(value) => onChange({ ...cred, [field]: value })}
        />
      )}
    </Field>
  );
}

type MethodFieldsProps = Readonly<{ mode: string; cred: SourceCred; onChange: (next: SourceCred) => void }>;

/** API Key — 공공데이터는 서비스키 한 칸, 그 밖은 전달 위치 · 이름 · 키(옛 :90-91) */
function KeyFields({ mode, cred, onChange }: MethodFieldsProps) {
  const isGov = mode === 'gov';
  return (
    <>
      {isGov ? null : (
        <>
          <Field label={SOURCES.auth.location}>
            {({ id }) => (
              <Select
                variant="form"
                id={id}
                value={keyLocationOf(cred.in)}
                onValueChange={(value) => onChange(changeKeyLocation(cred, keyLocationOf(value)))}
              >
                <option value="header">{SOURCES.auth.header}</option>
                <option value="query">{SOURCES.auth.query}</option>
              </Select>
            )}
          </Field>
          <CredInput
            key="key:name"
            field="name"
            label={SOURCES.auth.keyName}
            cred={cred}
            onChange={onChange}
            mono
            placeholder={KEY_HEADER_DEFAULT}
          />
        </>
      )}
      <CredInput
        key="key:key"
        field="key"
        label={isGov ? SOURCES.auth.serviceKey : SOURCES.auth.key}
        cred={cred}
        onChange={onChange}
        secret
        placeholder={isGov ? SOURCES.auth.serviceKeyPlaceholder : undefined}
      />
    </>
  );
}

/** 방식별 칸(옛 :89-94). 칸마다 key를 달아 방식을 바꾸면 새 칸이 된다(옛은 칸을 새로 그렸다) */
function MethodFields({ mode, cred, onChange }: MethodFieldsProps) {
  const common = { cred, onChange };
  switch (cred.type) {
    case 'key':
      return <KeyFields mode={mode} cred={cred} onChange={onChange} />;
    case 'bearer':
      return <CredInput key="bearer:key" field="key" label={SOURCES.auth.token} secret {...common} />;
    case 'basic':
    case 'wss':
    case 'session':
      return (
        <>
          <CredInput key={`${cred.type}:username`} field="username" label={SOURCES.auth.username} {...common} />
          <CredInput key={`${cred.type}:password`} field="password" label={SOURCES.auth.password} secret {...common} />
        </>
      );
    case 'oauth':
      return (
        <>
          <CredInput
            key="oauth:tokenUrl"
            field="tokenUrl"
            label={SOURCES.auth.tokenUrl}
            mono
            placeholder={SOURCES.auth.tokenUrlPlaceholder}
            {...common}
          />
          <CredInput key="oauth:clientId" field="clientId" label={SOURCES.auth.clientId} {...common} />
          <CredInput key="oauth:clientSecret" field="clientSecret" label={SOURCES.auth.clientSecret} secret {...common} />
        </>
      );
    default:
      // 인증 없음 · 모르는 방식은 칸이 없다(옛 :89 body = '')
      return null;
  }
}

export function AuthForm({ mode, cred, onChange }: AuthFormProps) {
  return (
    <>
      <Field label={SOURCES.auth.method}>
        {({ id }) => (
          <Select variant="form" id={id} value={cred.type} onValueChange={(type) => onChange({ ...cred, type })}>
            {authOptionsOf(mode).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <MethodFields mode={mode} cred={cred} onChange={onChange} />
    </>
  );
}
