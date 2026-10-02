import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, env, keys, projectOfJob, ttl24h } from './aws';
import type { JobStage } from './types';

export interface JobEvent {
  at: string;
  stage: JobStage;
  message: string;
  level?: 'info' | 'success' | 'warn' | 'error';
}

/** Moves a job to a new stage, stamps stage timing and appends a timeline event. */
export async function setStage(jobId: string, stage: JobStage, message: string, extra: Record<string, unknown> = {}, level: JobEvent['level'] = 'info') {
  const now = new Date().toISOString();
  const names: Record<string, string> = { '#s': 'status', '#st': 'stages', '#stage': stage, '#e': 'events', '#u': 'updatedAt', '#g': 'GSI1PK', '#ttl': 'ttl' };
  const values: Record<string, unknown> = { ':s': stage, ':now': now, ':ev': [{ at: now, stage, message, level }], ':empty': [], ':g': `STATUS#${stage}`, ':ttl': ttl24h() };
  let set = '#s = :s, #u = :now, #g = :g, #ttl = :ttl, #e = list_append(if_not_exists(#e, :empty), :ev), #st.#stage = if_not_exists(#st.#stage, :now)';
  Object.entries(extra).forEach(([k, v], i) => {
    names[`#x${i}`] = k;
    values[`:x${i}`] = v;
    set += `, #x${i} = :x${i}`;
  });
  await ddb.send(new UpdateCommand({
    TableName: env('TABLE_NAME'),
    Key: keys.job(projectOfJob(jobId), jobId),
    UpdateExpression: `SET ${set}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function logEvent(jobId: string, stage: JobStage, message: string, level: JobEvent['level'] = 'info') {
  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: env('TABLE_NAME'),
    Key: keys.job(projectOfJob(jobId), jobId),
    UpdateExpression: 'SET #e = list_append(if_not_exists(#e, :empty), :ev), #u = :now',
    ExpressionAttributeNames: { '#e': 'events', '#u': 'updatedAt' },
    ExpressionAttributeValues: { ':ev': [{ at: now, stage, message, level }], ':empty': [], ':now': now },
  }));
}
