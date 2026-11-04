import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { palette, typography, shape, motion } from './tokens';

/**
 * DreamHouse MUI Theme
 *
 * Design philosophy:
 *   — Zero border radius: architectural precision, no soft edges
 *   — Flat elevation: depth via contrast & borders, never blur
 *   — Single accent (lime): todo lo demás es silencio
 *   — Typography-first: el espacio entre letras es parte del diseño
 *   — Colombia: la audacia del detalle en medio del rigor
 */

// Shared structural options (same for light + dark)
const sharedOptions: Partial<ThemeOptions> = {
  shape: {
    borderRadius: shape.radius,
  },

  spacing: 8, // 8px base grid

  breakpoints: {
    values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
  },

  transitions: {
    duration: {
      shortest:       150,
      shorter:        200,
      short:          250,
      standard:       300,
      complex:        375,
      enteringScreen: 225,
      leavingScreen:  195,
    },
    easing: {
      easeInOut: motion.easing.standard,
      easeOut:   motion.easing.decelerate,
      easeIn:    motion.easing.accelerate,
      sharp:     motion.easing.sharp,
    },
  },

  typography: {
    fontFamily: typography.fontSans,
    fontWeightLight:   typography.weight.light,
    fontWeightRegular: typography.weight.regular,
    fontWeightMedium:  typography.weight.medium,
    fontWeightBold:    typography.weight.bold,

    h1: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size['6xl'],
      fontWeight:    typography.weight.black,
      letterSpacing: typography.tracking.tightest,
      lineHeight:    0.85,
      textTransform: 'uppercase' as const,
    },
    h2: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size['5xl'],
      fontWeight:    typography.weight.black,
      letterSpacing: typography.tracking.tighter,
      lineHeight:    0.9,
      textTransform: 'uppercase' as const,
    },
    h3: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size['4xl'],
      fontWeight:    typography.weight.black,
      letterSpacing: typography.tracking.tight,
      lineHeight:    1.0,
      textTransform: 'uppercase' as const,
    },
    h4: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size['3xl'],
      fontWeight:    typography.weight.bold,
      letterSpacing: typography.tracking.tight,
      lineHeight:    1.1,
    },
    h5: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size['2xl'],
      fontWeight:    typography.weight.bold,
      letterSpacing: typography.tracking.tight,
      lineHeight:    1.2,
    },
    h6: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size.xl,
      fontWeight:    typography.weight.semibold,
      letterSpacing: typography.tracking.normal,
      lineHeight:    1.3,
    },

    subtitle1: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size.md,
      fontWeight:    typography.weight.medium,
      letterSpacing: typography.tracking.wide,
      textTransform: 'uppercase' as const,
    },
    subtitle2: {
      fontFamily:    typography.fontMono,
      fontSize:      typography.size['2xs'],
      fontWeight:    typography.weight.bold,
      letterSpacing: typography.tracking.caps,
      textTransform: 'uppercase' as const,
    },

    body1: {
      fontFamily:  typography.fontSans,
      fontSize:    typography.size.base,
      fontWeight:  typography.weight.regular,
      lineHeight:  typography.leading.relaxed,
    },
    body2: {
      fontFamily:  typography.fontSans,
      fontSize:    typography.size.sm,
      fontWeight:  typography.weight.regular,
      lineHeight:  typography.leading.normal,
    },

    caption: {
      fontFamily:    typography.fontMono,
      fontSize:      typography.size.xs,
      fontWeight:    typography.weight.medium,
      letterSpacing: typography.tracking.wider,
      textTransform: 'uppercase' as const,
    },

    overline: {
      fontFamily:    typography.fontMono,
      fontSize:      typography.size['2xs'],
      fontWeight:    typography.weight.bold,
      letterSpacing: typography.tracking.caps,
      textTransform: 'uppercase' as const,
    },

    button: {
      fontFamily:    typography.fontSans,
      fontSize:      typography.size.xs,
      fontWeight:    typography.weight.black,
      letterSpacing: typography.tracking.widest,
      textTransform: 'uppercase' as const,
    },
  },
};

// ─── Dark Theme (default) ────────────────────────────────────────────────────

export const darkTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'dark',
    primary: {
      main:         palette.lime,
      dark:         palette.limeDim,
      light:        '#E8FF4D',
      contrastText: palette.ink,
    },
    secondary: {
      main:         palette.stone300,
      dark:         palette.stone400,
      light:        palette.stone200,
      contrastText: palette.ink,
    },
    background: {
      default: palette.ink,
      paper:   palette.stone900,
    },
    text: {
      primary:   '#F7F6F4',
      secondary: palette.stone400,
      disabled:  palette.stone600,
    },
    divider: palette.stone700,
    error:   { main: palette.error },
    warning: { main: palette.warning },
    success: { main: palette.success },
    info:    { main: palette.info },
  },

  components: {
    // ── CssBaseline ───────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { scrollBehavior: 'smooth' },
        body: {
          backgroundColor: palette.ink,
          color: '#F7F6F4',
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
        },
        '::selection': {
          backgroundColor: palette.lime,
          color: palette.ink,
        },
        '::-webkit-scrollbar': { width: '6px' },
        '::-webkit-scrollbar-track': { background: palette.ink },
        '::-webkit-scrollbar-thumb': { background: palette.lime },
      },
    },

    // ── Button ────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '14px 32px',
          fontSize: typography.size.xs,
          fontWeight: typography.weight.black,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
          transition: `all ${motion.duration.normal} ${motion.easing.architectural}`,
          '&:focus-visible': {
            outline: `2px solid ${palette.lime}`,
            outlineOffset: '2px',
          },
          // contained primary
          '&.MuiButton-containedPrimary': {
            backgroundColor: palette.lime,
            color: palette.ink,
            border: `1px solid ${palette.lime}`,
            '&:hover': {
              backgroundColor: '#F7F6F4',
              borderColor: '#F7F6F4',
              color: palette.ink,
            },
            '&:active': { backgroundColor: palette.limeDim },
          },
          // contained secondary
          '&.MuiButton-containedSecondary': {
            backgroundColor: palette.stone800,
            color: '#F7F6F4',
            border: `1px solid ${palette.stone700}`,
            '&:hover': {
              backgroundColor: palette.stone700,
              borderColor: palette.stone600,
            },
          },
          // outlined (default / no color)
          '&.MuiButton-outlined:not(.MuiButton-outlinedPrimary):not(.MuiButton-outlinedSecondary)': {
            border: `1px solid ${palette.stone600}`,
            color: '#F7F6F4',
            '&:hover': {
              borderColor: palette.lime,
              color: palette.lime,
              backgroundColor: 'transparent',
            },
          },
          // outlined primary
          '&.MuiButton-outlinedPrimary': {
            border: `1px solid ${palette.lime}`,
            color: palette.lime,
            '&:hover': {
              backgroundColor: palette.lime,
              color: palette.ink,
            },
          },
          // text
          '&.MuiButton-text': {
            color: palette.stone300,
            padding: '10px 16px',
            '&:hover': {
              color: '#F7F6F4',
              backgroundColor: 'transparent',
            },
          },
          // sizes
          '&.MuiButton-sizeSmall': { padding: '10px 20px', fontSize: typography.size['2xs'] },
          '&.MuiButton-sizeLarge': { padding: '18px 48px', fontSize: typography.size.sm },
        },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          transition: `all ${motion.duration.fast} ${motion.easing.standard}`,
          '&:hover': { backgroundColor: palette.stone800 },
        },
      },
    },

    // ── Card ──────────────────────────────────────────────────────────────
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: `1px solid ${palette.stone800}`,
          backgroundColor: palette.stone900,
          backgroundImage: 'none',
          transition: `all ${motion.duration.normal} ${motion.easing.architectural}`,
          '&:hover': {
            borderColor: palette.stone600,
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '32px',
          '&:last-child': { paddingBottom: '32px' },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: 'none',
          backgroundColor: palette.stone900,
          border: `1px solid ${palette.stone800}`,
        },
      },
    },

    // ── TextField ─────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: typography.fontSans,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.stone700,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.stone500,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.lime,
            borderWidth: '1px',
          },
        },
        input: {
          padding: '14px 16px',
          fontSize: typography.size.sm,
          '&::placeholder': { color: palette.stone500, opacity: 1 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: typography.fontMono,
          fontSize: typography.size.xs,
          letterSpacing: typography.tracking.wider,
          textTransform: 'uppercase',
          color: palette.stone400,
          '&.Mui-focused': { color: palette.lime },
        },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: typography.fontMono,
          fontSize: typography.size['2xs'],
          fontWeight: typography.weight.bold,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
          height: '24px',
        },
        filled: {
          backgroundColor: palette.stone800,
          color: palette.stone300,
          '&:hover': { backgroundColor: palette.stone700 },
        },
        outlined: {
          borderColor: palette.stone700,
          color: palette.stone300,
          '&:hover': { borderColor: palette.lime, color: palette.lime },
        },
        colorPrimary: {
          backgroundColor: palette.lime,
          color: palette.ink,
          '&:hover': { backgroundColor: palette.limeDim },
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: palette.stone800 },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderBottom: `1px solid transparent`,
          backgroundImage: 'none',
          transition: `all ${motion.duration.normal} ${motion.easing.standard}`,
        },
        colorPrimary: {
          backgroundColor: 'transparent',
        },
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 0,
          backgroundColor: '#F7F6F4',
          color: palette.ink,
          fontFamily: typography.fontMono,
          fontSize: typography.size.xs,
          letterSpacing: typography.tracking.wide,
          border: `1px solid ${palette.stone300}`,
          boxShadow: 'none',
        },
        arrow: {
          color: '#F7F6F4',
        },
      },
    },

    // ── Snackbar / Alert ──────────────────────────────────────────────────
    MuiAlert: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: typography.fontSans,
          fontSize: typography.size.sm,
        },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '14px 16px',
          fontFamily: typography.fontSans,
          fontSize: typography.size.sm,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: `1px solid ${palette.stone700}`,
          backgroundColor: palette.stone900,
          boxShadow: 'none',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: typography.fontSans,
          fontSize: typography.size.sm,
          padding: '12px 16px',
          '&:hover': { backgroundColor: palette.stone800 },
          '&.Mui-selected': {
            backgroundColor: 'transparent',
            color: palette.lime,
            '&:hover': { backgroundColor: palette.stone800 },
          },
        },
      },
    },

    // ── Linear Progress ───────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: palette.stone800,
          height: '2px',
        },
        bar: { backgroundColor: palette.lime },
      },
    },

    // ── Skeleton ──────────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: palette.stone800,
        },
      },
    },

    // ── Badge ─────────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          borderRadius: 0,
          fontFamily: typography.fontMono,
          fontSize: '12px',
          fontWeight: typography.weight.black,
          letterSpacing: '0.05em',
          height: '16px',
          minWidth: '16px',
          padding: '0 4px',
        },
      },
    },

    // ── Tab ───────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: typography.fontMono,
          fontSize: typography.size.xs,
          fontWeight: typography.weight.bold,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
          borderRadius: 0,
          minHeight: '48px',
          color: palette.stone400,
          '&.Mui-selected': { color: palette.lime },
          '&:hover': { color: '#F7F6F4' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: palette.lime,
          height: '1px',
        },
      },
    },
  },
});

// ─── Light Theme ─────────────────────────────────────────────────────────────

export const lightTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'light',
    primary: {
      main:         palette.lime,
      dark:         palette.limeDim,
      light:        '#E8FF4D',
      contrastText: palette.ink,
    },
    secondary: {
      main:         palette.stone700,
      dark:         palette.stone800,
      light:        palette.stone500,
      contrastText: palette.chalk,
    },
    background: {
      default: palette.chalk,
      paper:   '#FFFFFF',
    },
    text: {
      primary:   palette.ink,
      secondary: palette.stone600,
      disabled:  palette.stone300,
    },
    divider: palette.stone200,
    error:   { main: palette.error },
    warning: { main: palette.warning },
    success: { main: palette.success },
    info:    { main: palette.info },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { scrollBehavior: 'smooth' },
        body: {
          backgroundColor: palette.chalk,
          color: palette.ink,
          '-webkit-font-smoothing': 'antialiased',
        },
        '::selection': {
          backgroundColor: palette.lime,
          color: palette.ink,
        },
        '::-webkit-scrollbar': { width: '6px' },
        '::-webkit-scrollbar-track': { background: palette.stone100 },
        '::-webkit-scrollbar-thumb': { background: palette.ink },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '14px 32px',
          fontSize: typography.size.xs,
          fontWeight: typography.weight.black,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
          transition: `all ${motion.duration.normal} ${motion.easing.architectural}`,
          '&.MuiButton-containedPrimary': {
            backgroundColor: palette.lime,
            color: palette.ink,
            border: `1px solid ${palette.lime}`,
            '&:hover': {
              backgroundColor: palette.ink,
              borderColor: palette.ink,
              color: palette.chalk,
            },
          },
          '&.MuiButton-outlined:not(.MuiButton-outlinedPrimary):not(.MuiButton-outlinedSecondary)': {
            border: `1px solid ${palette.stone300}`,
            color: palette.ink,
            '&:hover': { borderColor: palette.ink, backgroundColor: 'transparent' },
          },
          '&.MuiButton-outlinedPrimary': {
            border: `1px solid ${palette.ink}`,
            color: palette.ink,
            '&:hover': { backgroundColor: palette.ink, color: palette.chalk },
          },
          '&.MuiButton-text': {
            color: palette.stone600,
            padding: '10px 16px',
            '&:hover': { color: palette.ink, backgroundColor: 'transparent' },
          },
          '&.MuiButton-sizeSmall': { padding: '10px 20px', fontSize: typography.size['2xs'] },
          '&.MuiButton-sizeLarge': { padding: '18px 48px', fontSize: typography.size.sm },
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: `1px solid ${palette.stone200}`,
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
          transition: `all ${motion.duration.normal} ${motion.easing.architectural}`,
          '&:hover': { borderColor: palette.stone400 },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: '32px', '&:last-child': { paddingBottom: '32px' } },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          border: `1px solid ${palette.stone200}`,
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.stone300,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.stone500,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: palette.ink,
            borderWidth: '1px',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: typography.fontMono,
          fontSize: typography.size.xs,
          letterSpacing: typography.tracking.wider,
          textTransform: 'uppercase',
          color: palette.stone500,
          '&.Mui-focused': { color: palette.ink },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: typography.fontMono,
          fontSize: typography.size['2xs'],
          fontWeight: typography.weight.bold,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
        },
        filled: {
          backgroundColor: palette.stone100,
          color: palette.stone700,
          '&:hover': { backgroundColor: palette.stone200 },
        },
        outlined: {
          borderColor: palette.stone300,
          color: palette.stone700,
          '&:hover': { borderColor: palette.ink, color: palette.ink },
        },
        colorPrimary: {
          backgroundColor: palette.lime,
          color: palette.ink,
        },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: palette.stone200 } },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 0, backgroundColor: palette.stone200, height: '2px' },
        bar: { backgroundColor: palette.ink },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: typography.fontMono,
          fontSize: typography.size.xs,
          fontWeight: typography.weight.bold,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
          color: palette.stone500,
          '&.Mui-selected': { color: palette.ink },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: palette.ink, height: '1px' },
      },
    },
  },
});
