// apps/web/src/screens/project/ProjectHeader.tsx — 프로젝트 헤더: PageHeader(이름 · 설명 · 태그 · 생성일 · 업데이트 · 구분선) + 우측 톱니(actions · 준비 중)
import { IconButton, PageHeader, Tag } from '@/ui';
import type { Project } from '../../api/types';
import { PROJECT } from '../../copy/project';
import { dateLabel } from '../../copy/time';

// 준비 중 항목은 no-op 버튼 + title
const noop = () => undefined;

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <PageHeader
      divider
      actions={
        <IconButton
          icon="settings"
          variant="filled"
          size="sm-plus"
          title={PROJECT.settingsTitle}
          onClick={noop}
        />
      }
      title={project.name}
      description={project.description === '' ? PROJECT.descriptionEmpty : project.description}
      tags={project.tags.map((tag) => (
        <Tag key={tag} variant="project">
          {tag}
        </Tag>
      ))}
      meta={[
        { label: PROJECT.createdLabel, value: dateLabel(project.createdAt) },
        { label: PROJECT.updatedLabel, value: dateLabel(project.updatedAt) },
      ]}
    />
  );
}
