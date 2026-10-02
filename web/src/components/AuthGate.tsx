import { useEffect, useState, type ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { loadConfig, type RuntimeConfig } from '../lib/config';

function Brand() {
  return (
    <div className="px-2 pb-6 pt-10 text-center">
      <div className="eyebrow text-amber">Thoughtworks &amp; AWS AI Works</div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Modernization Studio</h1>
      <p className="mt-2 text-sm text-fg-muted">Sign in with your invited account. Multi-factor authentication (authenticator app) is required.</p>
    </div>
  );
}

export interface SessionInfo {
  username: string;
  signOut: () => void;
  preview: boolean;
}

/** Cognito sign-in (SRP + mandatory TOTP MFA). Without /config.json (local `vite dev`) the UI runs as a backend-less preview. */
export function AuthGate({ children }: { children: (s: SessionInfo) => ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig | null | undefined>(undefined);

  useEffect(() => {
    void loadConfig().then((c) => {
      if (c) {
        Amplify.configure({ Auth: { Cognito: { userPoolId: c.userPoolId, userPoolClientId: c.userPoolClientId, loginWith: { email: true } } } });
      }
      setConfig(c);
    });
  }, []);

  if (config === undefined) return <div className="grid min-h-screen place-items-center text-fg-muted">Loading…</div>;
  if (config === null) {
    if (import.meta.env.DEV) return <>{children({ username: 'local-preview', signOut: () => undefined, preview: true })}</>;
    return <div className="grid min-h-screen place-items-center text-fg-muted">Configuration unavailable.</div>;
  }

  return (
    <div className="min-h-screen">
      <Authenticator hideSignUp components={{ Header: Brand }}>
        {({ signOut, user }) => <>{children({ username: user?.signInDetails?.loginId ?? user?.username ?? 'user', signOut: () => signOut?.(), preview: false })}</>}
      </Authenticator>
    </div>
  );
}
