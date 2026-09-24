import React, { useState } from 'react';
import { TextField, Box } from '@mui/material';
import { LoadingButton } from '@mui/lab';
import AuthLayout from '../../components/auth/AuthLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { notify } from '../../components/NotificationProvider';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      notify('Invalid or missing reset token', 'error');
      return;
    }
    if (password !== confirmPassword) {
      notify('Passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      notify('Password reset successfully! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      console.error('Reset password failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      helperText="Remember your password?"
      helperLink="/login"
      helperLinkText="Back to login"
    >
      <Box component="form" onSubmit={handleReset} noValidate sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          label="New Password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          Update Password
        </LoadingButton>
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;
