import { BedrockRuntimeClient, ConverseCommand, type ToolInputSchema } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { env } from './aws';

const client = new BedrockRuntimeClient({
  requestHandler: new NodeHttpHandler({ requestTimeout: 14 * 60 * 1000 }),
  maxAttempts: 4,
});

export interface ToolCallResult<T> {
  output: T;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  modelId: string;
}

/**
 * Calls Claude on Bedrock via Converse and forces a single structured tool call, returning its input.
 * Customer code is sent only in the request; Bedrock does not store or train on prompts/completions.
 */
export async function callTool<T>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<ToolCallResult<T>> {
  const modelId = env('MODEL_ID');
  const guardrailId = process.env.GUARDRAIL_ID;
  const started = Date.now();
  const res = await client.send(new ConverseCommand({
    modelId,
    system: [{ text: opts.system }],
    messages: [{ role: 'user', content: [{ text: opts.user }] }],
    inferenceConfig: { maxTokens: opts.maxTokens ?? 16000, temperature: 0 },
    toolConfig: {
      tools: [{ toolSpec: { name: opts.toolName, description: opts.toolDescription, inputSchema: { json: opts.schema } as ToolInputSchema } }],
      toolChoice: { tool: { name: opts.toolName } },
    },
    ...(guardrailId ? { guardrailConfig: { guardrailIdentifier: guardrailId, guardrailVersion: process.env.GUARDRAIL_VERSION ?? 'DRAFT' } } : {}),
  }));
  if (res.stopReason === 'max_tokens') throw new Error('Model output truncated (max_tokens)');
  if (res.stopReason === 'guardrail_intervened') throw new Error('Request blocked by Bedrock Guardrail');
  const block = res.output?.message?.content?.find((c) => c.toolUse)?.toolUse;
  if (!block?.input) throw new Error(`Model did not call ${opts.toolName} (stopReason=${res.stopReason})`);
  return {
    output: block.input as T,
    usage: { inputTokens: res.usage?.inputTokens ?? 0, outputTokens: res.usage?.outputTokens ?? 0 },
    latencyMs: Date.now() - started,
    modelId,
  };
}
