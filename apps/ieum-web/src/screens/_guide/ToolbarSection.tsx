// 카탈로그 Toolbar 절 — 왼쪽 무리 + ToolbarSpacer + 오른쪽 무리 · 검색 포함 · 맨 앞 라벨 · 빈칸 없음. 좁게 접히는 모양과 760 이하 빈칸 숨김 · 검색이 남은 폭을 채우는 것은 폭 전환으로 본다
import { useState } from 'react';
import { Button, SearchInput, Select, Toolbar, ToolbarSpacer } from '../../ui';
import catalog from './catalog.module.css';

const SOURCES = ['주문 시스템', '재고 시스템', '공공데이터 포털'] as const;

export function ToolbarSection() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<string>(SOURCES[0]);
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        한 줄에 놓고 좁으면 접는다(간격 --s-2). ToolbarSpacer는 남은 폭을 차지하고 760 이하에서는 숨는다. 위 바깥 여백은
        쓰는 곳이 준다. label은 맨 앞 보이는 글자일 뿐이다 — 뒤 선택의 이름은 선택의 aria-label이 준다.
      </p>
      <h3 className={catalog.heading}>왼쪽 무리 + 빈칸 + 오른쪽 무리</h3>
      <Toolbar>
        <Button size="sm">전체</Button>
        <Button size="sm">성공</Button>
        <Button size="sm">실패</Button>
        <ToolbarSpacer />
        <Button size="sm">내보내기</Button>
        <Button size="sm" variant="primary">
          새로 받기
        </Button>
      </Toolbar>
      <h3 className={catalog.heading}>검색 포함 — 760 이하에서 검색이 남은 폭을 채운다</h3>
      <Toolbar>
        <Button size="sm">전체</Button>
        <Button size="sm">성공</Button>
        <Button size="sm">실패</Button>
        <ToolbarSpacer />
        <SearchInput label="로그 검색" placeholder="도구 · 클라이언트 검색" value={query} onValueChange={setQuery} />
        <Button size="sm" variant="primary">
          새로 받기
        </Button>
      </Toolbar>
      <h3 className={catalog.heading}>맨 앞 라벨(label) + 선택 + 오른쪽 무리</h3>
      <Toolbar label="원본 시스템">
        <Select variant="toolbar" aria-label="원본 시스템 선택" value={source} onValueChange={setSource}>
          {SOURCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <ToolbarSpacer />
        <Button size="sm" variant="primary">
          새로 받기
        </Button>
      </Toolbar>
      <h3 className={catalog.heading}>빈칸 없음 — 왼쪽으로 붙는다</h3>
      <Toolbar>
        <Button size="sm">필터</Button>
        <Button size="sm">정렬</Button>
      </Toolbar>
      <h3 className={catalog.heading}>많은 도구 — 줄바꿈</h3>
      <Toolbar>
        {Array.from({ length: 14 }, (_, i) => (
          <Button key={i} size="sm">
            도구 {i + 1}
          </Button>
        ))}
        <ToolbarSpacer />
        <Button size="sm" variant="primary">
          실행
        </Button>
      </Toolbar>
    </div>
  );
}
