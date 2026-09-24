import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    IconButton,
    InputAdornment,
    CircularProgress,
    Alert,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Visibility, VisibilityOff, CheckCircleOutline } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../lib/api';

const onboardSchema = z.object({
    fullName: z.string().min(2, 'Full name is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type OnboardForm = z.infer<typeof onboardSchema>;

const Onboard: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [invitationData, setInvitationData] = useState<any>(null);
    const [isVerifying, setIsVerifying] = useState(true);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setVerifyError('Invalid invitation link. No token found.');
            setIsVerifying(false);
            return;
        }
        verifyToken();
    }, [token]);

    const verifyToken = async () => {
        try {
            const { data } = await api.get(`/api/auth/invitation/${token}`);
            setInvitationData(data);
        } catch (err: any) {
            setVerifyError(err.response?.data?.error || 'Invalid or expired invitation.');
        } finally {
            setIsVerifying(false);
        }
    };

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<OnboardForm>({
        resolver: zodResolver(onboardSchema),
    });

    const onSubmit = async (data: OnboardForm) => {
        setIsSubmitting(true);
        try {
            await api.post('/api/auth/onboard', {
                token,
                password: data.password,
                name: data.fullName,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            console.error('Onboarding failed', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isVerifying) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (verifyError) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <Alert severity="error" variant="filled" sx={{ borderRadius: '12px' }}>
                    {verifyError}
                </Alert>
            </Box>
        );
    }

    if (success) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <Card sx={{ maxWidth: 400, width: '100%', borderRadius: '20px', textAlign: 'center' }}>
                    <CardContent sx={{ p: 4 }}>
                        <CheckCircleOutline sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Account Setup Complete!</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Redirecting you to login page...
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    }

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
            <Card sx={{ maxWidth: 450, width: '100%', borderRadius: '20px' }}>
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
                        sx={{ mb: 1, textAlign: 'center', fontWeight: 700 }}
                    >
                        Join {invitationData?.orgName || 'Organization'}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ mb: 4, textAlign: 'center', opacity: 0.6 }}
                    >
                        Create your account to accept the invitation as an <strong>{invitationData?.role}</strong>.
                    </Typography>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <TextField
                            fullWidth
                            label="Email Address"
                            variant="outlined"
                            margin="normal"
                            value={invitationData?.email || ''}
                            disabled
                            helperText="The email address assigned to this invitation."
                        />
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
                            label="Password"
                            variant="outlined"
                            type={showPassword ? 'text' : 'password'}
                            margin="normal"
                            {...register('password')}
                            error={!!errors.password}
                            helperText={errors.password?.message}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <LoadingButton
                            fullWidth
                            size="large"
                            type="submit"
                            variant="contained"
                            loading={isSubmitting}
                            sx={{ py: 1.5, mt: 3, borderRadius: '12px' }}
                        >
                            Set Password & Join
                        </LoadingButton>
                    </form>
                </CardContent>
            </Card>
        </Box>
    );
};

export default Onboard;
