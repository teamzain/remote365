import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

// twoFactorSetupRequired: the org requires 2FA and this account has none, so
// the temp token starts the setup step instead of the code prompt.
type OAuthGrant = { accessToken?: string; refreshToken?: string; tempToken?: string; twoFactorSetupRequired?: boolean };

// These calls carry the NEW sign-in's credentials, so they skip `api`: its
// interceptor swaps in whatever token an earlier session left in storage
// (possibly revoked, which would bounce this page to /login).
const authApi = axios.create({ baseURL: api.defaults.baseURL });

// The code works once, and the effect can run twice for the same URL
// (React StrictMode in development): share one exchange per code.
const exchanges = new Map<string, Promise<OAuthGrant>>();
const exchangeCode = (code: string): Promise<OAuthGrant> => {
  const pending: Promise<OAuthGrant> = exchanges.get(code)
    ?? authApi.post('/api/auth/oauth/exchange', { code }).then(({ data }: { data: OAuthGrant }) => data);
  exchanges.set(code, pending);
  return pending;
};

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // The API sends a one-time code; builds from before that put the
        // tokens in the URL itself. replace: keep the callback URL out of history.
        const code = searchParams.get('code');
        const grant: OAuthGrant = code
          ? await exchangeCode(code)
          : {
              accessToken: searchParams.get('accessToken') || undefined,
              refreshToken: searchParams.get('refreshToken') || undefined,
              tempToken: searchParams.get('tempToken') || undefined,
              twoFactorSetupRequired: searchParams.get('setup2fa') === '1',
            };

        if (grant.tempToken) {
          useAuthStore.getState().setTemp2faToken(grant.tempToken, Boolean(grant.twoFactorSetupRequired));
          navigate('/2fa', { replace: true });
          return;
        }

        const { accessToken, refreshToken } = grant;
        if (!accessToken || !refreshToken) {
          console.error('OAuth tokens missing from URL');
          navigate('/login', { replace: true });
          return;
        }

        // We have the tokens, now get the user profile with them.
        const { data } = await authApi.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = data.user || data;
        setAuth(user, accessToken, refreshToken);
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('OAuth callback failed', error);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuth]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
        Completing your sign in...
      </Typography>
    </Box>
  );
};

export default AuthCallback;
