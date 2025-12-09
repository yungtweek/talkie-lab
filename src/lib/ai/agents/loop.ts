// src/lib/llm/agent-loop.ts

import '@/lib/ai/agents/tools';
import { runAgentTool } from '@/lib/ai/agents/tools-registry';
import { type AgentMode, type AgentToolName, isAgentToolName } from '@/lib/ai/agents/types';
import { openAIProvider } from '@/lib/ai/llm/providers/openai';
import {
  type LLMStreamEvent,
  type ResponsesCreateParams,
  LLMStreamEventType,
  type InputItem,
} from '@/lib/ai/llm/types';

interface ToolCall {
  name: AgentToolName;
  callId: string;
  args: Record<string, unknown>;
}

type AgentToolResult = Awaited<ReturnType<typeof runAgentTool>>;

/**
 * 에이전트 모드 전용 루프.
 * - 내부에서 openAIProvider.streamChat을 여러 번 호출하지만
 * - 바깥에는 하나의 연속된 스트림처럼 보이게 이벤트를 이어서 yield
 */
export async function* runAgentChatLoop(
  initialReq: ResponsesCreateParams,
  opts?: { maxHops?: number },
): AsyncGenerator<LLMStreamEvent> {
  // 최소 2회 이상 hop을 보장해야 tool 호출 → 재요청 루프가 동작한다.
  const requestedMaxHops = opts?.maxHops ?? 3;
  const maxHops = Math.max(requestedMaxHops, 2);

  let hop = 0;
  let currentReq = {
    ...initialReq,
    // agent 모드 강제
    mode: 'agent' as AgentMode,
  };

  while (hop < maxHops) {
    hop += 1;

    const toolCallsThisHop: ToolCall[] = [];
    const toolMessages: InputItem[] = [];
    for await (const ev of openAIProvider.createStreamResponse(currentReq)) {
      const raw = ev;
      if (raw.type === LLMStreamEventType.Reasoning) {
        const reasoning = raw.item;
        toolMessages.push(reasoning);
      }
      if (raw.type === LLMStreamEventType.FunctionCall) {
        const fc = raw.item;
        console.log('[Agent] Function call:', raw);
        let parsedArgs: Record<string, unknown> = {};
        if (fc.arguments.trim()) {
          try {
            parsedArgs = JSON.parse(fc.arguments);
          } catch (e) {
            console.warn('[Agent] Failed to parse tool arguments', e, fc.arguments);
          }
        }

        if (isAgentToolName(fc.name)) {
          toolMessages.push(fc);
          yield {
            type: LLMStreamEventType.UsingTool,
            item: {
              name: fc.name,
              id: fc.callId,
              args: parsedArgs ?? {},
              status: 'pending',
            },
          };
          toolCallsThisHop.push({
            name: fc.name,
            callId: fc.callId,
            args: parsedArgs ?? {},
          });
        } else {
          console.warn('[Agent] Skipped unknown tool:', fc.name);
        }
      }

      yield ev;
    }

    console.log('[Agent] Tool calls this hop:', toolCallsThisHop);

    if (toolCallsThisHop.length === 0) {
      break;
    }

    for (const call of toolCallsThisHop) {
      console.log('[Agent] Executing tool:', call.name, call.args);
      console.log('[Agent] call: ', call);

      let result!: AgentToolResult;
      try {
        result = await runAgentTool(call.name, call.args);
      } catch (err: any) {
        // runAgentTool 실패시에도 AgentToolResult 타입을 일관하게 유지하기 위해 ok: false를 명시하고,
        // error 필드는 string으로 맞춘다.
        const msg = err?.message ?? String(err);
        result = {
          ok: false as const,
          error: msg,
          message: msg,
          stack: err?.stack,
        } as unknown as AgentToolResult;
      }

      // 툴 사용 종료 이벤트 및 모델로 전달할 payload를 상태별로 분기 처리
      if (result.ok) {
        // 성공 케이스
        yield {
          type: LLMStreamEventType.UsingTool,
          item: {
            id: call.callId,
            name: call.name,
            args: call.args,
            status: 'succeeded',
            resultPreview: result.data,
          },
        };

        toolMessages.push({
          type: 'function_call_output',
          callId: call.callId,
          output: JSON.stringify(result.data),
        });
      } else {
        // 실패 케이스: 에러를 그대로 모델에 전달
        console.warn('[Agent] Tool failed, passing error to model:', result);

        yield {
          type: LLMStreamEventType.UsingTool,
          item: {
            id: call.callId,
            name: call.name,
            args: call.args,
            status: 'failed',
            resultPreview: result,
          },
        };

        toolMessages.push({
          type: 'function_call_output',
          callId: call.callId,
          output: JSON.stringify(result),
        });
      }
    }

    const prevInput = currentReq.input ?? [];
    const nextInput = [...prevInput, ...toolMessages];

    currentReq = {
      ...currentReq,
      input: nextInput,
    };
  }
}
