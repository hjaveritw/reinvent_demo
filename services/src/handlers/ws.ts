import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2, APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { z } from 'zod';
import { ddb, env, keys, ttl24h } from '../lib/aws';
import { validateBatch } from '../lib/telemetry';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

/** $connect REQUEST authorizer: browsers cannot set headers on WebSocket upgrades, so the Cognito access token is passed as ?token=. */
export async function authorize(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  verifier ??= CognitoJwtVerifier.create({ userPoolId: env('USER_POOL_ID'), clientId: env('USER_POOL_CLIENT_ID'), tokenUse: 'access' });
  const token = event.queryStringParameters?.token ?? '';
  try {
    const payload = await verifier.verify(token);
    return { principalId: payload.sub, policyDocument: { Version: '2012-10-17', Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: event.methodArn }] }, context: { sub: payload.sub } };
  } catch {
    throw new Error('Unauthorized');
  }
}

const Telemetry = z.object({
  action: z.literal('telemetry'),
  sessionId: z.string().uuid(),
  sentAt: z.number(),
  samples: z.array(z.object({
    tick: z.number().int().nonnegative(),
    distance: z.number().nonnegative(),
    speed: z.number().positive(),
    score: z.number().int().nonnegative(),
    y: z.number().optional(),
    state: z.enum(['RUNNING', 'JUMPING', 'DEAD']).optional(),
  })).min(1).max(60),
});
const Ping = z.object({ action: z.literal('ping'), sentAt: z.number() });

const ok = (): APIGatewayProxyResult => ({ statusCode: 200, body: '' });

export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResult> {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  if (routeKey === '$connect' || routeKey === '$disconnect') return ok();
  const sub = (event.requestContext as unknown as { authorizer?: { sub?: string } }).authorizer?.sub;
  if (!sub) return { statusCode: 401, body: 'unauthorized' };
  if ((event.body?.length ?? 0) > 32_768) return { statusCode: 413, body: 'too large' };
  const mgmt = new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
  const reply = (data: unknown) => mgmt.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(JSON.stringify(data)) }));

  let msg: unknown;
  try {
    msg = JSON.parse(event.body ?? '');
  } catch {
    return { statusCode: 400, body: 'bad json' };
  }
  const ping = Ping.safeParse(msg);
  if (ping.success) {
    await reply({ type: 'pong', sentAt: ping.data.sentAt, serverTime: Date.now() });
    return ok();
  }
  const parsed = Telemetry.safeParse(msg);
  if (!parsed.success) return { statusCode: 400, body: 'invalid message' };
  const { sessionId, samples, sentAt } = parsed.data;
  const table = env('TABLE_NAME');

  const existing = (await ddb.send(new GetCommand({ TableName: table, Key: keys.sessionSummary(sessionId) }))).Item;
  if (existing && existing.owner !== sub) return { statusCode: 403, body: 'forbidden' };
  if (existing?.finished) {
    await reply({ type: 'ack', accepted: false, reason: 'session finished' });
    return ok();
  }
  const prev = { lastTick: existing?.lastTick ?? 0, lastDistance: existing?.lastDistance ?? 0 };
  const result = validateBatch(prev, samples);
  const now = Date.now();
  await ddb.send(new PutCommand({
    TableName: table,
    Item: { ...keys.sessionTick(sessionId, samples[0].tick), sessionId, receivedAt: now, firstTick: samples[0].tick, lastTick: samples.at(-1)!.tick, samples, ttl: ttl24h() },
  }));
  await ddb.send(new PutCommand({
    TableName: table,
    Item: {
      ...keys.sessionSummary(sessionId),
      owner: sub,
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
      batches: (existing?.batches ?? 0) + 1,
      ticks: result.lastTick,
      lastTick: result.lastTick,
      lastDistance: result.lastDistance,
      serverScore: result.ok ? result.serverScore : existing?.serverScore ?? 0,
      finished: result.finished || !result.ok,
      suspicious: existing?.suspicious || !result.ok,
      suspicionReason: result.ok ? existing?.suspicionReason : result.reason,
      ttl: ttl24h(),
    },
  }));
  await reply({ type: 'ack', accepted: result.ok, reason: result.reason, serverTick: result.lastTick, serverScore: result.serverScore, batch: (existing?.batches ?? 0) + 1, sentAt, serverTime: now });
  return ok();
}
