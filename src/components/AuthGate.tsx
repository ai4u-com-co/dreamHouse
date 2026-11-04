'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import Header from '@/components/Header';
import LegacyHistoryDialog from '@/components/LegacyHistoryDialog';
import { DhButton } from '@/components/brand';
import { useAuth } from '@/context/AuthContext';
import { palette, typography as t } from '@/lib/theme/tokens';

/**
 * Puerta del Studio: solo se ve con sesión de Google y membresía de DreamHouse. La protección real está en el servidor
 * (las rutas /api exigen sesión y cobran créditos) y en la base (RLS); esto es la parte visible.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { state, email, userId, error, signIn, signOut } = useAuth();

  if (state === 'ready') {
    return (
      <>
        <LegacyHistoryDialog ownerId={userId} email={email} />
        {children}
      </>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Header />
      <Container maxWidth="sm" sx={{ py: { xs: 8, md: 14 } }}>
        <Stack spacing={4} sx={{ textAlign: 'center', alignItems: 'center' }} data-testid="auth-gate">
          {state === 'loading' ? (
            <CircularProgress aria-label="Comprobando tu sesión" />
          ) : (
            <>
              <Typography
                component="h1"
                sx={{ fontFamily: t.fontSans, fontSize: t.size['3xl'], fontWeight: t.weight.black, letterSpacing: t.tracking.tightest, textTransform: 'uppercase' }}
              >
                {state === 'no_access' ? 'Sin acceso' : 'Entra al Studio'}
              </Typography>
              <Typography sx={{ fontSize: t.size.sm, color: palette.stone500, lineHeight: 1.6 }}>
                {state === 'no_access'
                  ? `La cuenta ${email} no tiene acceso a DreamHouse. Entra con otra cuenta de Google.`
                  : 'Entra con tu cuenta de Google para diseñar. Las imágenes se generan con GPT Image 2.5; no necesitas ninguna clave.'}
              </Typography>
              {error && (
                <Typography role="alert" sx={{ fontSize: t.size.sm, color: palette.warning }}>
                  {error}
                </Typography>
              )}
              <DhButton variant="contained" color="primary" onClick={() => void signIn()} sx={{ minHeight: 48 }}>
                Entrar con Google
              </DhButton>
              {state === 'no_access' && (
                <DhButton variant="text" color="primary" onClick={() => void signOut()} sx={{ minHeight: 44 }}>
                  Cerrar sesión
                </DhButton>
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
