import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Tabs as RadixTabs } from 'radix-ui';
import { cx } from '../lib/cx';
import { modalPanelClass } from '../Modal/ModalPanel';
import styles from './Tabs.module.css';

export type TabItem = {
  value: string;
  label: string;
  disabled?: boolean;
  reason?: string;
  /** rail 항목 메모(소스 설정 모달). 빈 문자열도 칸을 남긴다 */
  note?: string;
  /** 탭 title. 없으면 잠긴 탭의 reason */
  title?: string;
};

export type TabsVariant = 'line' | 'rail';

/** rail이면 Tabs.Content가 설정 모달 내용 열(ModalPanel 상자)이 된다 */
const VariantContext = createContext<TabsVariant>('line');

export type TabsProps = Pick<
  ComponentProps<typeof RadixTabs.Root>,
  'value' | 'defaultValue' | 'onValueChange'
> & {
  items: TabItem[];
  /** line(가로 밑줄, 기본) · rail(설정 모달 세로 레일 188 — 목록 + 내용 열(Tabs.Content)을 한 행에) */
  variant?: TabsVariant;
  className?: string;
  children?: ReactNode;
};

const TabsRoot = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { items, variant = 'line', className, children, ...root },
  ref,
) {
  const isRail = variant === 'rail';
  const baseId = useId();
  return (
    <RadixTabs.Root
      ref={ref}
      className={cx(styles.root, className)}
      data-variant={variant}
      orientation={isRail ? 'vertical' : 'horizontal'}
      {...root}
    >
      <RadixTabs.List className={styles.list} data-variant={variant}>
        {items.map((item) => {
          const noteId = `${baseId}-${item.value}-note`;
          return (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              className={styles.trigger}
              disabled={item.disabled}
              title={item.title ?? (item.disabled ? item.reason : undefined)}
              // rail은 메모가 트리거 안에 있어 이름이 라벨 + 메모로 합쳐지므로 이름을 라벨로 고정하고 메모는 설명으로 잇는다
              aria-label={isRail ? item.label : undefined}
              aria-describedby={isRail && item.note ? noteId : undefined}
            >
              {isRail ? (
                <>
                  <span className={styles.railLabel}>{item.label}</span>
                  <span id={noteId} className={styles.railNote}>
                    {item.note ?? ''}
                  </span>
                </>
              ) : (
                item.label
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
      <VariantContext.Provider value={variant}>{children}</VariantContext.Provider>
    </RadixTabs.Root>
  );
});

/** rail이면 내용 열 상자(안쪽 20 24 · gap 16 · 스크롤 · 폼 칸 최대 --w-field)를 갖는다 — 화면이 CSS를 쓰지 않는다 */
function Content({ className, ...rest }: ComponentProps<typeof RadixTabs.Content>) {
  const variant = useContext(VariantContext);
  return (
    <RadixTabs.Content
      className={cx(variant === 'rail' && modalPanelClass, className)}
      data-variant={variant}
      {...rest}
    />
  );
}

export const Tabs = Object.assign(TabsRoot, { Content });
