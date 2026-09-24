import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Link,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Google } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterForm = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register: signup, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await signup(data.fullName, data.email, data.password, '');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration failed', error);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/google`;
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', borderRadius: '20px' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="h4"
            color="primary"
            sx={{ fontWeight: 900, mb: 1, textAlign: 'center' }}
          >
            Remote365
          </Typography>
          <Typography
            variant="h6"
            sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}
          >
            Create your account
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Full Name"
              variant="outlined"
              margin="normal"
              {...register('fullName')}
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
            />
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              type="password"
              margin="normal"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <LoadingButton
              fullWidth
              size="large"
              type="submit"
              variant="contained"
              loading={isLoading}
              sx={{ py: 1.5, mt: 3, borderRadius: '12px' }}
            >
              Create Account
            </LoadingButton>

            <Divider sx={{ my: 3 }}>OR</Divider>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<Google />}
              onClick={handleGoogleSignup}
              sx={{ py: 1.5, borderRadius: '12px', fontWeight: 700 }}
            >
              Sign up with Google
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Box sx={{ position: 'absolute', bottom: 32 }}>
        <Typography variant="body2">
          Already have an account?{' '}
          <Link component={RouterLink as any} to="/login" sx={{ fontWeight: 700 }}>
            Sign in
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;
