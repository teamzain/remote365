import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  MoreVert as MoreIcon,
  DesktopWindows as DesktopIcon,
  VpnKey as KeyIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useDeviceStore } from '../../store/deviceStore';
import api from '../../lib/api';
import { notify } from '../../components/NotificationProvider';
import { openSessionTab } from '../../lib/sessionLauncher';

interface DeviceCardProps {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  accessKey: string;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ id, name, status, lastSeen, accessKey }) => {
  const { removeDevice, regenerateKey, updateDeviceName } = useDeviceStore();
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [isRenaming, setIsRenaming] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await removeDevice(id);
      setConfirmOpen(false);
      notify('Device removed successfully', 'success');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRegenerateKey = async () => {
    handleMenuClose();
    await regenerateKey(id);
    notify('Access key regenerated', 'success');
  };

  const handleEditClick = () => {
    handleMenuClose();
    setEditOpen(true);
  };

  const handleConfirmRename = async () => {
    setIsRenaming(true);
    try {
      await updateDeviceName(id, newName);
      setEditOpen(false);
      notify('Device renamed successfully', 'success');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConnect = async (devicePassword?: string) => {
    setIsConnecting(true);
    const cleanKey = accessKey.replace(/\s/g, '');
    
    try {
      const { data } = await api.post('/api/devices/verify-access', {
        accessKey: cleanKey,
        password: devicePassword
      });

      if (data.token) {
        openSessionTab(id, { accessToken: data.token, deviceName: data.device?.name, accessKey: cleanKey });
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Password required
        setPasswordOpen(true);
      } else if (error.response?.status === 409) {
        notify('Device is currently offline.', 'warning');
      } else if (error.response?.status === 429) {
        notify('Too many failed attempts. Please wait before trying again.', 'error');
      } else {
        notify(error.response?.data?.error || 'Connection failed.', 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const isOnline = status === 'online';

  return (
    <>
      <Card
        sx={{
          borderRadius: '16px',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: (theme) => theme.shadows[8],
          },
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: isOnline ? 'success.dark' : 'action.hover',
                  color: isOnline ? 'success.contrastText' : 'text.secondary',
                  display: 'flex',
                }}
              >
                <DesktopIcon />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Last seen: {lastSeen}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={handleMenuOpen}>
              <MoreIcon />
            </IconButton>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Chip
              label={isOnline ? 'Online' : 'Offline'}
              size="small"
              color={isOnline ? 'success' : 'default'}
              sx={{ fontWeight: 800, borderRadius: '6px' }}
            />
            <Chip
              label="v1.0.4"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: '6px' }}
            />
          </Stack>

          <Box
            sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'background.default',
              border: '1px dashed',
              borderColor: 'divider',
              mb: 3,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {accessKey}
                </Typography>
              </Stack>
              <Tooltip title="Regenerate Key">
                <IconButton size="small" onClick={handleRegenerateKey}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <LoadingButton
            fullWidth
            variant="contained"
            startIcon={<PlayIcon />}
            loading={isConnecting}
            disabled={!isOnline}
            onClick={() => handleConnect()}
            sx={{
              borderRadius: '12px',
              py: 1,
              fontWeight: 800,
              textTransform: 'none',
            }}
          >
            Connect Now
          </LoadingButton>
        </CardContent>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={handleEditClick}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            Edit Name
          </MenuItem>
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            Remove Device
          </MenuItem>
        </Menu>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Rename Device</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Device Name"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={handleConfirmRename}
            loading={isRenaming}
            sx={{ borderRadius: '8px' }}
          >
            Save Changes
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Device Password</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This device requires a password to connect.
          </DialogContentText>
          <TextField
            autoFocus
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPasswordOpen(false)}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={() => handleConnect(password)}
            loading={isConnecting}
            sx={{ borderRadius: '8px' }}
          >
            Verify & Connect
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => !isDeleting && setConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Remove Device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{name}</strong>? This action cannot be undone and will revoke all access keys associated with this device.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={isDeleting} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleConfirmDelete}
            loading={isDeleting}
            color="error"
            variant="contained"
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3 }}
          >
            Confirm Removal
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DeviceCard;
