import React, { useState, useEffect } from 'react';
import { TextField, Box, Typography } from '@mui/material';
import AuthLayout from '../../components/auth/AuthLayout';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const TwoFactor: React.FC = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { verify2fa, temp2faToken, isLoading: loading } = useAuthStore();

  useEffect(() => {
    if (!temp2faToken) {
      navigate('/login');
    }
  }, [temp2faToken, navigate]);

  const handleSubmit = async (value: string = code) => {
    if (!temp2faToken || value.length < 6) return;
    try {
      await verify2fa(value, temp2faToken);
      navigate('/dashboard');
    } catch (error) {
      console.error('2FA verification failed', error);
      setCode('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 6) {
      setCode(value);
      if (value.length === 6) {
        handleSubmit(value);
      }
    }
  };

  return (
    <AuthLayout
      title="Secure Security"
      helperText="Lost your device?"
      helperLink="/forgot-password"
      helperLinkText="Get help"
    >
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter the 6-digit code from your authenticator app
        </Typography>

        <TextField
          required
          fullWidth
          value={code}
          onChange={handleChange}
          disabled={loading}
          variant="outlined"
          placeholder="000000"
          inputProps={{
            maxLength: 6,
            style: {
              textAlign: 'center',
              fontSize: '2rem',
              letterSpacing: '0.5rem',
              fontWeight: 700,
            },
          }}
          helperText={loading ? 'Verifying code...' : '6-digit code'}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255, 255, 255, 0.03)',
            },
          }}
        />
      </Box>
    </AuthLayout>
  );
};

export default TwoFactor;
