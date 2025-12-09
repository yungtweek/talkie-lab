import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';

import { useArtifactContext } from '@/components/artifact-provider';
import { Spinner } from '@/components/ui/spinner';
import { type UIArtifact } from '@/hooks/use-artifact';

// Basic renderer for UIArtifact.
// This version only handles plain text content.
// More renderers (code/image/sheet) can be added later.

function renderStatusIndicator(actionState: UIArtifact['actionState'], toolLabel?: string) {
  // actionState rules:
  // 'none'        -> render nothing
  // 'pending'     -> Thinking...
  // 'reasoning'   -> Reasoning...
  // 'using-tool'  -> toolLabel (if provided)
  // 'generating'  -> render nothing

  if (actionState === 'none') {
    return null;
  }

  let label: string | null = null;
  let textClass = 'text-muted-foreground';

  switch (actionState) {
    case 'pending':
      label = 'Thinking...';
      break;
    case 'generating':
      label = 'Generating...';
      break;
    case 'reasoning':
      label = 'Reasoning...';
      break;
    case 'using-tool':
      label = toolLabel || 'Running tool...';
      textClass = 'TODO';
      break;
  }

  return (
    <div className={`flex items-center gap-2 mb-1 text-sm animate-pulse ${textClass}`}>
      <div className="flex items-center justify-center">{<Spinner />}</div>
      {label && <span className="leading-none flex items-center">{label}</span>}
    </div>
  );
}

export function ArtifactRenderer() {
  const { artifact } = useArtifactContext();

  const prevStatusRef = useRef(artifact.status);

  useEffect(() => {
    if (prevStatusRef.current !== artifact.status) {
      prevStatusRef.current = artifact.status;
    }
  }, [artifact.status]);
  const toolMessages: Record<string, string> = {
    prompt_search_by_tag: '프롬프트 검색 중…',
    prompt_commit_tool: '새 버전 저장 중…',
  };
  // Derive active tool label from toolRuns
  const activeRun = artifact.toolRuns.find(r => r.status === 'running' || r.status === 'pending');
  const toolLabel = activeRun ? toolMessages[activeRun.name] || `${activeRun.name} 실행 중…` : null;

  if (artifact.status === 'idle') return null;

  return (
    <div className="flex justify-start">
      <div data-artifact className="rounded-lg px-4 py-2 w-full">
        {renderStatusIndicator(artifact.actionState, toolLabel ?? undefined)}

        <div className="message-body text-base relative">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeSanitize]}
            components={
              {
                // br: () => <br />,
              }
            }
          >
            {artifact.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
