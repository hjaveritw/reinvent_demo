import { fetchAuthSession } from 'aws-amplify/auth';
import { getConfig } from './config';

/** Cognito access token for API Gateway / WebSocket authorizers (null in local preview). */
export async function accessToken(): Promise<string | null> {
  if (!getConfig()) return null;
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() ?? null;
}
