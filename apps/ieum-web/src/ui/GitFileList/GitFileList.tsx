// GitFileList — 탐색 Git 소스 분석: 끝난 단계 목록 + 파일 줄. 이음 .gst · .gfiles · .gf(css/console.css:1002-1017, 1100 :1055) · 쓰는 곳 js/menu/discovery.js:202-208
// 상자 머리는 쓰는 곳의 Box padded다. 완료 원 · 아이콘은 장식이고 단계 · 파일은 글자로 읽힌다.
// 마지막 파일 줄 등장 모션은 그 줄이 처음 그려질 때 한 번만 돈다 — 같은 key의 요소를 React가 그대로 두므로 갱신마다 다시 돌지 않는다(옛은 700ms마다 다시 돌았다)
import { Fragment, type ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { MethodChip } from '../MethodChip';
import styles from './GitFileList.module.css';

/** 사용 중단 표시 — 소스의 애너테이션 이름이라 화면 문구가 아니고 부품이 쓴다(js/menu/discovery.js:207) */
const DEPRECATED_ANNOTATION = '@Deprecated';

export type GitStageItem = Readonly<{
  key: string;
  /** 굵은 서버 문장 */
  title: ReactNode;
  /** 흐린 보조 글 */
  detail?: ReactNode;
}>;

type GitFileApi = Readonly<{
  /** 메서드 — 소스에 없으면 쓰는 곳이 "*"를 넘긴다(js/menu/discovery.js:206) */
  method: string;
  path: string;
  /** 사용 중단 API — 경로 뒤에 위험색 작은 "@Deprecated" */
  deprecated?: boolean;
}>;

export type GitFileItem = Readonly<{
  key: string;
  /** 파일 칸 글자(옛 "…/{파일}" — 쓰는 곳이 만든다) — 앞 code 아이콘 · 고정폭 · 말줄임 */
  name: ReactNode;
  /** 파일 칸 툴팁(전체 경로) */
  title: string;
  apis: readonly GitFileApi[];
  /** 오른쪽 흐린 메모(서버 문장). 없으면 그리지 않는다 */
  note?: ReactNode;
}>;

export type GitFileListProps = {
  /** 끝난 단계 — 완료 원 + 굵은 문장 + 흐린 보조 */
  stages: readonly GitStageItem[];
  /** 단계가 아직 없을 때 흐린 한 줄(옛 "저장소를 읽는 중") */
  pending: ReactNode;
  /** 파일 줄 — 없으면 목록 상자를 그리지 않는다(옛 .gfiles:empty) */
  files: readonly GitFileItem[];
  /** 마지막 파일 줄 등장 모션 — 쓰는 곳은 탐색 중일 때 true(js/menu/discovery.js:205) */
  enterLast?: boolean;
};

function GitFileRow({ file, isEntering }: { file: GitFileItem; isEntering: boolean }) {
  return (
    <div className={styles.file} data-enter={isEntering || undefined}>
      <span className={styles.name}>
        <Icon name="code" size="sm" className={styles.nameIcon} />
        <span className={styles.nameText} title={file.title}>
          {file.name}
        </span>
      </span>
      <span className={styles.apis}>
        {file.apis.map((api, index) => (
          <Fragment key={index}>
            <MethodChip method={api.method} />
            <span className={styles.path}>
              {api.path}
              {api.deprecated === true ? (
                <>
                  {' '}
                  <em className={styles.deprecated}>{DEPRECATED_ANNOTATION}</em>
                </>
              ) : null}
            </span>
          </Fragment>
        ))}
      </span>
      {file.note !== undefined ? <span className={styles.note}>{file.note}</span> : null}
    </div>
  );
}

export function GitFileList({ stages, pending, files, enterLast = false }: GitFileListProps) {
  return (
    <div>
      <div className={styles.stages}>
        {stages.length === 0 ? (
          <div className={styles.pending}>{pending}</div>
        ) : (
          stages.map((stage) => (
            <div key={stage.key} className={styles.stage}>
              <span className={styles.done}>
                <Icon name="check" size="sm" stroke="heavy" />
              </span>
              <b className={styles.stageTitle}>{stage.title}</b>
              {stage.detail !== undefined ? <span className={styles.detail}>{stage.detail}</span> : null}
            </div>
          ))
        )}
      </div>
      {files.length > 0 ? (
        <div className={styles.files}>
          {files.map((file, index) => (
            <GitFileRow key={file.key} file={file} isEntering={enterLast && index === files.length - 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
