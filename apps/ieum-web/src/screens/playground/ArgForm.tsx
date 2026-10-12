// 인자 폼 — 고른 도구의 보이는 파라미터마다 칸 하나(옛 pgArgsHTML — js/menu/playground.js:22-32).
// 라벨 = AI 파라미터 이름, 툴팁 = 설명, 필수면 빨간 " *"(시각 숨김 "필수"가 입력 설명). 칸 모양은 app/playground/args inputKind:
// 고르기(코드표 AI 값 · enum)와 참/거짓은 맨 앞 빈 옵션 + Select, 그 밖은 글자 Input(객체 · 배열은 고정폭). 보이는 파라미터가 없으면 한 줄 안내.
// 폼 값은 도구별로 저장소에 글자로 남는다. 아직 채우지 않은 칸은 초기값으로 그리고(argValues), 도구 · 저장 값이 바뀔 때마다 그 칸을
// 저장소에도 채운다(ensureArgs — 옛 pgArgs가 그릴 때마다 채웠다). 그래서 초기화 · 도구 바꿈 · 스튜디오 저장 뒤에도 예시값이 다시 들어간다.
// 저장된 값이 옵션에 없으면 화면은 빈 옵션이고 호출에는 그 값이 실린다(옛 그대로). <form>이 아니라 Enter로 실행하지 않는다(옛 그대로)
import { useEffect } from 'react';
import type { Tool, ToolParam } from '../../api/types';
import { argValues, inputKind } from '../../app/playground/args';
import { ensureArgs, setArg, useStoredArgs } from '../../app/playground/store';
import { visibleParams } from '../../app/convert/visibleParams';
import { PLAYGROUND } from '../../copy/playground';
import { STUDIO } from '../../copy/studio';
import { Field, HelpText, Input, Select } from '@/ui';

/** 필수 * 표지의 대체 글자 — 변환 스튜디오 매핑 표와 같은 낱말(옛 title "필수") */
const REQUIRED_LABEL = STUDIO.params.required;

type ArgFieldProps = Readonly<{
  toolId: string;
  param: ToolParam;
  value: string;
}>;

function ArgField({ toolId, param, value }: ArgFieldProps) {
  const kind = inputKind(param);
  const onValueChange = (next: string) => setArg(toolId, param.a, next);
  return (
    <Field
      label={param.a}
      labelTitle={param.d || undefined}
      requiredLabel={param.req ? REQUIRED_LABEL : undefined}
    >
      {(control) =>
        kind.kind === 'text' ? (
          <Input
            id={control.id}
            aria-describedby={control.describedBy}
            mono={kind.mono}
            value={value}
            onValueChange={onValueChange}
          />
        ) : (
          <Select
            variant="form"
            id={control.id}
            aria-describedby={control.describedBy}
            value={value}
            onValueChange={onValueChange}
          >
            <option value="" />
            {kind.options.map((option, index) => (
              // 옵션 글이 겹칠 수 있어 순서를 키로 쓴다(옛 옵션 목록 그대로)
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )
      }
    </Field>
  );
}

type ArgFormProps = Readonly<{
  tool: Tool;
}>;

export function ArgForm({ tool }: ArgFormProps) {
  const stored = useStoredArgs(tool.id);
  useEffect(() => {
    ensureArgs(tool);
  }, [tool, stored]);

  const params = visibleParams(tool);
  const values = argValues(tool, stored);

  return (
    <div>
      {params.length === 0 ? (
        <HelpText>{PLAYGROUND.args.none}</HelpText>
      ) : (
        params.map((param) => <ArgField key={param.a} toolId={tool.id} param={param} value={values[param.a] ?? ''} />)
      )}
    </div>
  );
}
