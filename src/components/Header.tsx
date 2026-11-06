'use client';

import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import IosShareIcon from '@mui/icons-material/IosShare';

import { DhButton, DhLogo, DhBadge } from '@/components/brand';
import AccountChip from '@/components/AccountChip';
import { useTheme } from '@/components/ThemeProvider';
import { usePwa } from '@/components/PwaProvider';
import { palette, typography as t } from '@/lib/theme/tokens';

const NAV_LINKS = [
  { label: 'Vision',  href: '/#vision' },
  { label: 'Process', href: '/#process' },
  { label: 'Studio',  href: '/studio' },
  { label: 'Brand',   href: '/brand' },
];

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { theme, toggleTheme }      = useTheme();
  const pathname                    = usePathname();
  const { canInstall, needsIosInstructions, promptInstall } = usePwa();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setDrawerOpen(false);
    if (href.startsWith('/#') && pathname === '/') {
      const id = href.slice(2);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <AppBar
        position="sticky"
        sx={{
          backgroundColor: scrolled
            ? (theme === 'dark' ? 'rgba(5,5,5,0.92)' : 'rgba(247,246,244,0.92)')
            : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled
            ? `1px solid ${theme === 'dark' ? palette.stone800 : palette.stone200}`
            : '1px solid transparent',
          transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1440,
            width: '100%',
            mx: 'auto',
            px: { xs: 3, lg: 3, xl: 6 },
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '72px !important',
          }}
        >
          {/* Logo */}
          <DhLogo size="sm" />

          {/* Desktop nav */}
          <Box
            component="nav"
            sx={{
              display: { xs: 'none', lg: 'flex' },
              alignItems: 'center',
              gap: { lg: 2.5, xl: 6 },
            }}
          >
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => handleNavClick(href)}
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  sx={{
                    fontFamily: t.fontMono,
                    fontSize: t.size['2xs'],
                    fontWeight: t.weight.bold,
                    letterSpacing: t.tracking.caps,
                    textTransform: 'uppercase',
                    color:
                      (href === '/studio' && pathname === '/studio') ||
                      (href === '/brand' && pathname === '/brand')
                        ? palette.lime
                        : 'text.secondary',
                    transition: 'color 200ms ease',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {label}
                </Typography>
              </Link>
            ))}
          </Box>

          {/* Desktop actions */}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center' }}
          >
            {/* Cuenta: saldo de créditos y salir (Google) */}
            <AccountChip />

            {/* Theme toggle */}
            <IconButton onClick={toggleTheme} size="small" aria-label="Toggle theme">
              {theme === 'light'
                ? <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
                : <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
              }
            </IconButton>

            {/* CTA */}
            <Link href="/studio" style={{ textDecoration: 'none' }}>
              <DhButton variant="contained" color="primary" size="small">
                Start Project
              </DhButton>
            </Link>
          </Stack>

          {/* Mobile actions */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center' }}
          >
            {canInstall && (
              <IconButton onClick={() => void promptInstall()} aria-label="Instalar la app en tu celular" sx={{ width: 44, height: 44, color: palette.lime }}>
                <InstallMobileIcon sx={{ fontSize: 22 }} />
              </IconButton>
            )}
            <IconButton onClick={toggleTheme} aria-label="Cambiar tema claro u oscuro" sx={{ width: 44, height: 44 }}>
              {theme === 'light'
                ? <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />
                : <LightModeOutlinedIcon sx={{ fontSize: 20 }} />
              }
            </IconButton>
            <IconButton onClick={() => setDrawerOpen(!drawerOpen)} aria-label={drawerOpen ? 'Cerrar menú' : 'Abrir menú'} sx={{ width: 44, height: 44 }}>
              {drawerOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: '100vw',
              maxWidth: 400,
              backgroundColor: theme === 'dark' ? palette.ink : palette.chalk,
              borderLeft: `1px solid ${palette.stone800}`,
              px: 4,
              py: 8,
            },
          },
        }}
      >
        <Stack spacing={6}>
          <DhLogo size="md" />

          <Stack component="nav" spacing={4}>
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => handleNavClick(href)}
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  sx={{
                    fontFamily: t.fontSans,
                    fontSize: t.size['2xl'],
                    fontWeight: t.weight.black,
                    letterSpacing: t.tracking.tightest,
                    textTransform: 'uppercase',
                    color:
                      (href === '/studio' && pathname === '/studio') ||
                      (href === '/brand' && pathname === '/brand')
                        ? palette.lime
                        : 'text.primary',
                    '&:hover': { color: palette.lime },
                    transition: 'color 200ms ease',
                  }}
                >
                  {label}
                </Typography>
              </Link>
            ))}
          </Stack>

          <Box sx={{ borderTop: `1px solid ${palette.stone800}`, pt: 4 }}>
            <AccountChip stacked />
          </Box>

          {(canInstall || needsIosInstructions) && (
            <Box sx={{ border: `1px solid ${palette.stone800}`, p: 2.5 }}>
              <Typography sx={{ fontFamily: t.fontMono, fontSize: t.size.xs, fontWeight: t.weight.bold, letterSpacing: t.tracking.caps, textTransform: 'uppercase', color: palette.lime, mb: 1 }}>
                Instalar en tu celular
              </Typography>
              {canInstall ? (
                <>
                  <Typography sx={{ fontSize: t.size.sm, color: 'text.secondary', mb: 2 }}>
                    Ábrela como una app, a pantalla completa y desde tu pantalla de inicio.
                  </Typography>
                  <DhButton variant="outlined" color="primary" size="large" fullWidth onClick={() => { void promptInstall(); setDrawerOpen(false); }}>
                    Instalar DreamHouse
                  </DhButton>
                </>
              ) : (
                <Typography sx={{ fontSize: t.size.sm, color: 'text.secondary', lineHeight: 1.6 }}>
                  En Safari toca el botón <IosShareIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom' }} /> <strong>Compartir</strong> y elige
                  {' '}<strong>«Añadir a pantalla de inicio»</strong>.
                </Typography>
              )}
            </Box>
          )}

          <Link href="/studio" onClick={() => setDrawerOpen(false)} style={{ textDecoration: 'none' }}>
            <DhButton variant="contained" color="primary" size="large" fullWidth>
              Start Project
            </DhButton>
          </Link>

          <Box sx={{ mt: 'auto' }}>
            <DhBadge variant="stone" dot>Colombia · 2025</DhBadge>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
