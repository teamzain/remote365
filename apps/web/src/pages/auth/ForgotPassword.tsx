import React, { useState } from 'react';
import { TextField, Box } from '@mui/material';
import { LoadingButton } from '@mui/lab';
import AuthLayout from '../../components/auth/AuthLayout';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { notify } from '../../components/NotificationProvider';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
    } catch (err) {
      console.error('Forgot password failed', err);
      // We always show success as per requirement to prevent email enumeration
    } finally {
      setLoading(false);
      notify('If an account exists with that email, a reset link has been sent.', 'success');
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password?"
      helperText="Remember your password?"
      helperLink="/login"
      helperLinkText="Back to login"
    >
      <Box component="form" onSubmit={handleReset} noValidate sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          label="Email Address"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!error}
          helperText={error}
          sx={{ mb: 3 }}
        />

        <LoadingButton
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          loading={loading}
          sx={{ height: 48, borderRadius: '12px' }}
        >
          Send reset link
        </LoadingButton>
      </Box>
    </AuthLayout>
  );
};

export default ForgotPassword;
