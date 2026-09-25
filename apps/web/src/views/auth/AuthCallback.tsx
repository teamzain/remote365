import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const tempToken = searchParams.get('tempToken');

      if (tempToken) {
        useAuthStore.getState().setTemp2faToken(tempToken);
        navigate('/2fa');
        return;
      }

      if (!accessToken || !refreshToken) {
        console.error('OAuth tokens missing from URL');
        navigate('/login');
        return;
      }

      try {
        // We have the tokens, now get the user profile
        // The API client will use the new token from the URL if we set it in storage first 
        // Or we can pass it in the headers for this specific call
        const { data } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const user = data.user || data;
        setAuth(user, accessToken, refreshToken);
        navigate('/dashboard');
      } catch (error) {
        console.error('OAuth callback failed', error);
        navigate('/login');
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
