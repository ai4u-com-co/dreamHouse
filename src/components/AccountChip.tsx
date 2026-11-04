'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';

import { DhButton } from '@/components/brand';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/context/AuthContext';
import { palette, typography as t } from '@/lib/theme/tokens';

/** Cuenta de la persona: saldo de créditos y salir; sin sesión, «Entrar con Google». Reemplaza a los campos de claves de API. */
export default function AccountChip({ stacked = false }: { stacked?: boolean }) {
  const { state, email, credits, isAdmin, signIn, signOut } = useAuth();
  const { theme } = useTheme();

  if (state === 'loading') return null;

  if (state === 'signed_out') {
    return (
      <DhButton variant="outlined" color="primary" size="small" onClick={() => void signIn()} sx={{ minHeight: 44 }}>
        Entrar con Google
      </DhButton>
    );
  }

  const label = state !== 'ready' ? 'Sin acceso' : isAdmin ? 'Admin · sin límite' : `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        minHeight: 44,
        border: `1px solid ${palette.stone800}`,
        backgroundColor: theme === 'dark' ? palette.stone900 : '#FFFFFF',
        ...(stacked ? { flexWrap: 'wrap' } : {}),
      }}
    >
      <Typography
        data-testid="credits"
        title={email ?? undefined}
        sx={{
          fontFamily: t.fontMono,
          fontSize: '12px',
          fontWeight: t.weight.bold,
          letterSpacing: t.tracking.caps,
          textTransform: 'uppercase',
          color: state === 'ready' ? palette.lime : palette.warning,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="button"
        onClick={() => void signOut()}
        aria-label={`Cerrar sesión${email ? ` (${email})` : ''}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          minHeight: 44,
          minWidth: 44,
          fontFamily: t.fontMono,
          fontSize: '12px',
          fontWeight: t.weight.bold,
          letterSpacing: t.tracking.wide,
          textTransform: 'uppercase',
          color: palette.stone500,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          p: 0,
          '&:hover': { color: 'text.primary' },
        }}
      >
        <LogoutIcon sx={{ fontSize: 14 }} />
        Salir
      </Typography>
    </Box>
  );
}
