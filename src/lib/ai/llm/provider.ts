import type { LLMResponseObject, LLMStreamEvent, ResponsesCreateParams } from './types';

export interface LLMProvider {
  createStreamResponse(req: ResponsesCreateParams): AsyncGenerator<LLMStreamEvent>;
  createTextResponse(req: ResponsesCreateParams): Promise<LLMResponseObject>;
  getModels(): Promise<string[]>;
}
