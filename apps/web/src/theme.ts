import { createTheme, type ThemeOptions } from '@mui/material/styles';

// Brand color language (Figma):
// - Primary: #FF8A00 (orange)
// - Primary light: #FFB347
// - Ink: #111315
// - Gradient: linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: "'Mona Sans', sans-serif",
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
        containedPrimary: {
          background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)',
          boxShadow: '0 4px 14px rgba(255,138,0,0.35)',
          '&:hover': {
            background: 'linear-gradient(118.29deg, #F07E00 38.71%, #FF8A00 88.95%)',
            boxShadow: '0 6px 20px rgba(255,138,0,0.45)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#FF8A00',
    },
    secondary: {
      main: '#FFB347',
    },
    background: {
      default: '#F1F5F9',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
  },
  components: {
    ...baseOptions.components,
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF8A00',
    },
    secondary: {
      main: '#FFB347',
    },
    background: {
      default: '#080808',   // Matches desktop exactly
      paper: '#111111',     // Matches desktop cards/modals
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255,255,255,0.45)', // Like text-white/40
    },
    divider: 'rgba(255,255,255,0.06)',
    action: {
      hover: 'rgba(255,255,255,0.04)',
      selected: 'rgba(255,138,0,0.12)',
    },
  },
  components: {
    ...baseOptions.components,
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,255,255,0.06)',
          background: '#111111', // Match paper
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#080808', // Match background
          borderRight: '1px solid rgba(255,255,255,0.05)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#080808', // Match background
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(255,138,0,0.15)',
            '&:hover': {
              backgroundColor: 'rgba(255,138,0,0.2)',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.08)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255,255,255,0.18)',
            },
          },
        },
      },
    },
  },
});

export default lightTheme;
