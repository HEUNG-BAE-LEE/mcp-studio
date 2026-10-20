// 카탈로그 StatusDot 절(시각 숨김 글자 VisuallyHidden 포함) — 톤 다섯 점 · 글자 옆 점 · 시각 숨김 글자 확인
import { STATUS_VALUES, statusOf } from '../../copy/status';
import { StatusDot, VisuallyHidden, type StatusTone } from '../../ui';
import catalog from './catalog.module.css';

const TONES: readonly StatusTone[] = ['ok', 'warn', 'danger', 'info', 'mute'];

export function StatusDotSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        지름 8의 색 점. 점은 장식(aria-hidden)이고 상태 글자는 VisuallyHidden이 읽히며 마우스를 올리면 title로 보인다.
      </p>
      <h3 className={catalog.heading}>tone</h3>
      <div className={catalog.row}>
        {TONES.map((tone) => (
          <StatusDot key={tone} tone={tone} label={tone} />
        ))}
      </div>
      <h3 className={catalog.heading}>원본 상태 값</h3>
      <div className={catalog.row}>
        {STATUS_VALUES.source.map((value) => {
          const { label, tone } = statusOf('source', value);
          return <StatusDot key={value} tone={tone} label={label} />;
        })}
      </div>
      <h3 className={catalog.heading}>VisuallyHidden</h3>
      <p className={catalog.note}>
        아래 줄의 span · div는 화면에 자리를 차지하지 않는다. 스크린리더나 접근성 트리에서만 읽힌다.
      </p>
      <div className={catalog.frame}>
        <span>보이는 글자</span>
        <VisuallyHidden>보이지 않지만 읽히는 글자(span)</VisuallyHidden>
        <VisuallyHidden as="div">보이지 않지만 읽히는 블록(div)</VisuallyHidden>
      </div>
    </div>
  );
}
