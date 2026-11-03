'use client';

import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';

import { DhButton, DhLogo, DhBadge } from '@/components/brand';
import { useTheme } from '@/components/ThemeProvider';
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
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const { theme, toggleTheme }      = useTheme();
  const pathname                    = usePathname();

  useEffect(() => {
    const savedGemini = localStorage.getItem('GEMINI_API_KEY');
    if (savedGemini) setGeminiApiKey(savedGemini);
    const savedOpenai = localStorage.getItem('OPENAI_API_KEY');
    if (savedOpenai) setOpenaiApiKey(savedOpenai);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGeminiApiKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setGeminiApiKey(v);
    localStorage.setItem('GEMINI_API_KEY', v);
  };

  const handleOpenaiApiKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setOpenaiApiKey(v);
    localStorage.setItem('OPENAI_API_KEY', v);
  };

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
            px: { xs: 3, md: 6 },
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
              gap: 6,
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
            {/* API Key */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                border: `1px solid ${palette.stone800}`,
                backgroundColor: theme === 'dark' ? palette.stone900 : '#FFFFFF',
              }}
            >
              {geminiApiKey ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 14, color: palette.success }} />
              ) : (
                <ErrorOutlineIcon sx={{ fontSize: 14, color: palette.warning }} />
              )}
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: '9px',
                  fontWeight: t.weight.bold,
                  letterSpacing: t.tracking.caps,
                  textTransform: 'uppercase',
                  color: palette.stone500,
                  whiteSpace: 'nowrap',
                }}
              >
                {geminiApiKey ? 'Gemini Active' : 'Gemini Optional'}
              </Typography>
              <OutlinedInput
                type={keyVisible ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={handleGeminiApiKey}
                placeholder="Gemini key..."
                size="small"
                startAdornment={
                  <InputAdornment position="start">
                    <KeyIcon sx={{ fontSize: 12, color: palette.stone500 }} />
                  </InputAdornment>
                }
                sx={{
                  width: 160,
                  height: 28,
                  fontFamily: t.fontMono,
                  fontSize: t.size.xs,
                  border: 'none',
                  outline: 'none',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& input': { p: '0 4px', color: 'text.primary' },
                  '& input::placeholder': { color: palette.stone600, opacity: 1 },
                }}
              />
              <Typography
                component="button"
                onClick={() => setKeyVisible(!keyVisible)}
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: '9px',
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
                {keyVisible ? 'Hide' : 'Show'}
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                border: `1px solid ${palette.stone800}`,
                backgroundColor: theme === 'dark' ? palette.stone900 : '#FFFFFF',
              }}
            >
              {openaiApiKey ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 14, color: palette.success }} />
              ) : (
                <ErrorOutlineIcon sx={{ fontSize: 14, color: palette.warning }} />
              )}
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: '9px',
                  fontWeight: t.weight.bold,
                  letterSpacing: t.tracking.caps,
                  textTransform: 'uppercase',
                  color: palette.stone500,
                  whiteSpace: 'nowrap',
                }}
              >
                {openaiApiKey ? 'OpenAI Active' : 'OpenAI Required'}
              </Typography>
              <OutlinedInput
                type={keyVisible ? 'text' : 'password'}
                value={openaiApiKey}
                onChange={handleOpenaiApiKey}
                placeholder="OpenAI key..."
                size="small"
                startAdornment={
                  <InputAdornment position="start">
                    <KeyIcon sx={{ fontSize: 12, color: palette.stone500 }} />
                  </InputAdornment>
                }
                sx={{
                  width: 160,
                  height: 28,
                  fontFamily: t.fontMono,
                  fontSize: t.size.xs,
                  border: 'none',
                  outline: 'none',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& input': { p: '0 4px', color: 'text.primary' },
                  '& input::placeholder': { color: palette.stone600, opacity: 1 },
                }}
              />
              <Typography
                component="button"
                onClick={() => setKeyVisible(!keyVisible)}
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: '9px',
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
                {keyVisible ? 'Hide' : 'Show'}
              </Typography>
            </Box>

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
            <IconButton onClick={toggleTheme} size="small">
              {theme === 'light'
                ? <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
                : <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
              }
            </IconButton>
            <IconButton onClick={() => setDrawerOpen(!drawerOpen)} size="small">
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
            <Typography
              sx={{
                fontFamily: t.fontMono,
                fontSize: t.size.xs,
                fontWeight: t.weight.bold,
                letterSpacing: t.tracking.caps,
                textTransform: 'uppercase',
                color: palette.stone500,
                mb: 2,
              }}
            >
              Gemini API Key (opcional)
            </Typography>
            <OutlinedInput
              type="password"
              value={geminiApiKey}
              onChange={handleGeminiApiKey}
              placeholder="Enter your Gemini key..."
              fullWidth
              startAdornment={
                <InputAdornment position="start">
                  <KeyIcon sx={{ fontSize: 14 }} />
                </InputAdornment>
              }
              sx={{ fontFamily: t.fontMono, fontSize: t.size.sm }}
            />
            
            <Typography
              sx={{
                fontFamily: t.fontMono,
                fontSize: t.size.xs,
                fontWeight: t.weight.bold,
                letterSpacing: t.tracking.caps,
                textTransform: 'uppercase',
                color: palette.stone500,
                mb: 2,
                mt: 4,
              }}
            >
              OpenAI API Key (predeterminada)
            </Typography>
            <OutlinedInput
              type="password"
              value={openaiApiKey}
              onChange={handleOpenaiApiKey}
              placeholder="Enter your OpenAI key..."
              fullWidth
              startAdornment={
                <InputAdornment position="start">
                  <KeyIcon sx={{ fontSize: 14 }} />
                </InputAdornment>
              }
              sx={{ fontFamily: t.fontMono, fontSize: t.size.sm }}
            />
            <Typography
              sx={{
                fontFamily: t.fontMono,
                fontSize: '10px',
                color: palette.stone600,
                mt: 1,
              }}
            >
              Stored locally in your browser.
            </Typography>
          </Box>

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
