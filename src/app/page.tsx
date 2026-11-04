'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';

import Header from '@/components/Header';
import {
  DhButton,
  DhLabel,
  DhDivider,
  DhBadge,
  DhStat,
  DhSection,
} from '@/components/brand';
import { palette, typography as t } from '@/lib/theme/tokens';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FourKIcon from '@mui/icons-material/FourK';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GridViewIcon from '@mui/icons-material/GridView';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

const HERO_IMAGES = [
  '/images/dreamhouse-render.png',
  '/images/dreamhouse-render (1).png',
];

export default function Home() {
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setImgIndex((p) => (p + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', color: 'text.primary' }}>
      <Header />

      {/* ── Hero ── */}
      <Box
        component="section"
        id="hero"
        sx={{
          position: 'relative',
          height: '90svh',
          minHeight: 600,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {/* Slideshow */}
        {HERO_IMAGES.map((src, i) => (
          <Box
            key={src}
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: i === imgIndex ? 0.4 : 0,
              transition: 'opacity 1s ease',
            }}
          >
            <Image
              src={src}
              alt={`Architectural render ${i + 1}`}
              fill
              sizes="100vw"
              priority={i === 0}
              style={{ objectFit: 'cover', objectPosition: 'center' }}
            />
          </Box>
        ))}

        {/* Blueprint overlay */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(212,242,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,242,0,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            zIndex: 1,
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
            zIndex: 2,
          }}
        />

        {/* Content */}
        <Container
          maxWidth="xl"
          sx={{ position: 'relative', zIndex: 3, px: { xs: 3, md: 6 } }}
        >
          <Box sx={{ maxWidth: 900 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
              <Box sx={{ width: 48, height: '2px', backgroundColor: palette.lime }} />
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: t.size['2xs'],
                  fontWeight: t.weight.bold,
                  letterSpacing: t.tracking.caps,
                  textTransform: 'uppercase',
                  color: palette.lime,
                }}
              >
                Next-Gen Architectural AI
              </Typography>
            </Stack>

            <Typography
              component="h1"
              sx={{
                fontFamily: t.fontSans,
                fontSize: { xs: 'clamp(64px, 14vw, 160px)' },
                fontWeight: t.weight.black,
                letterSpacing: t.tracking.tightest,
                textTransform: 'uppercase',
                lineHeight: 0.85,
                color: '#fff',
                mb: 6,
              }}
            >
              Dream
              <Box component="span" sx={{ color: palette.lime }}>
                House
              </Box>
            </Typography>

            <Grid container spacing={{ xs: 4, md: 10 }} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: t.size.lg,
                    fontWeight: t.weight.light,
                    lineHeight: t.leading.relaxed,
                    borderLeft: `2px solid rgba(212,242,0,0.3)`,
                    pl: 3,
                  }}
                >
                  Democratizando la visualización arquitectónica. Genera exteriores fotorrealistas en segundos.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={3}>
                  <Link href="/studio" style={{ textDecoration: 'none' }}>
                    <DhButton
                      variant="contained"
                      color="primary"
                      size="large"
                      iconEnd={<ArrowForwardIcon />}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Iniciar Proyecto
                    </DhButton>
                  </Link>

                  <Stack direction="row" spacing={3}>
                    <DhBadge variant="ghost" dot>
                      <FlashOnIcon sx={{ fontSize: 10 }} />
                      Instant Exterior
                    </DhBadge>
                    <DhBadge variant="ghost" dot>
                      <FourKIcon sx={{ fontSize: 10 }} />
                      4K Quality
                    </DhBadge>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Container>

        {/* System status — bottom right */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            zIndex: 3,
            display: { xs: 'none', lg: 'block' },
            border: `1px solid rgba(255,255,255,0.12)`,
            p: 2,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Typography
            sx={{
              fontFamily: t.fontMono,
              fontSize: '12px',
              fontWeight: t.weight.bold,
              letterSpacing: t.tracking.caps,
              textTransform: 'uppercase',
              color: palette.lime,
              mb: 0.5,
            }}
          >
            System Status
          </Typography>
          <Typography
            sx={{
              fontFamily: t.fontMono,
              fontSize: t.size.xs,
              fontWeight: t.weight.bold,
              color: '#fff',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Engine: Nano Banana Pro v1.1
          </Typography>
          <Box sx={{ width: 128, height: '2px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Box sx={{ width: '75%', height: '100%', backgroundColor: palette.lime }} />
          </Box>
        </Box>
      </Box>

      {/* ── Vision ── */}
      <DhSection id="vision">
        <Grid container spacing={{ xs: 8, lg: 16 }} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={6}>
              <Box>
                <DhLabel index="01" accent>Nuestra Visión</DhLabel>
                <Typography
                  variant="h3"
                  sx={{
                    mt: 3,
                    fontSize: { xs: t.size['3xl'], md: t.size['4xl'] },
                  }}
                >
                  El Futuro de la{' '}
                  <Box
                    component="span"
                    sx={{
                      WebkitTextStroke: `1px ${palette.lime}`,
                      color: 'transparent',
                    }}
                  >
                    Arquitectura
                  </Box>{' '}
                  es Instantáneo.
                </Typography>
              </Box>

              <Typography
                variant="body1"
                sx={{ color: 'text.secondary', maxWidth: 520 }}
              >
                Diseñar una casa requiere conocimientos técnicos y recursos costosos. DreamHouse democratiza este proceso permitiendo a cualquier persona visualizar conceptos arquitectónicos de alta calidad instantáneamente.
              </Typography>

              <Grid container spacing={4}>
                <Grid size={{ xs: 6 }}>
                  <DhStat value="85%" label="Reducción en tiempo de generación" />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <DhStat value="100%" label="Fotorrealismo Garantizado" />
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '1 / 1',
                overflow: 'hidden',
                border: `1px solid ${palette.stone800}`,
                '&:hover img': {
                  filter: 'grayscale(0)',
                  transform: 'scale(1)',
                },
              }}
            >
              <Image
                src="/images/dreamhouse-render.png"
                alt="Architectural vision"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                style={{
                  objectFit: 'cover',
                  filter: 'grayscale(100%)',
                  transform: 'scale(1.05)',
                  transition: 'all 700ms cubic-bezier(0.16,1,0.3,1)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: `${palette.lime}1A`,
                  mixBlendMode: 'multiply',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </DhSection>

      <DhDivider />

      {/* ── Process ── */}
      <Box
        component="section"
        id="process"
        sx={{
          py: { xs: 10, md: 20 },
          backgroundColor: palette.ink === '#050505' ? 'background.paper' : palette.stone900,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 3, md: 6 } }}>
          <Grid
            container
            spacing={4}
            sx={{ mb: 10, justifyContent: 'space-between', alignItems: 'flex-end' }}
          >
            <Grid size={{ xs: 12, md: 7 }}>
              <DhLabel index="02" accent>El Proceso</DhLabel>
              <Typography
                variant="h3"
                sx={{ mt: 3, fontSize: { xs: t.size['2xl'], md: t.size['4xl'] } }}
              >
                Tres Pasos al{' '}
                <Box component="span" sx={{ color: palette.lime }}>
                  Exterior Perfecto.
                </Box>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: t.size.xs,
                  letterSpacing: t.tracking.wider,
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                Una interfaz única. Sin complicaciones. Todo lo que necesitas en un solo viewport.
              </Typography>
            </Grid>
          </Grid>

          <Grid container spacing={0.25}>
            {[
              {
                step: '01',
                title: 'Referencias',
                desc: 'Sube hasta 5 imágenes que capturen tu estilo, materiales o ambiente deseado.',
                icon: <ImageOutlinedIcon sx={{ fontSize: 32 }} />,
              },
              {
                step: '02',
                title: 'Parámetros',
                desc: 'Configura clima, ciudad, arquitectos y materiales con un control granular.',
                icon: <GridViewIcon sx={{ fontSize: 32 }} />,
              },
              {
                step: '03',
                title: 'Generación',
                desc: 'Nuestra IA analiza tus datos y crea un exterior fotorrealista 4K en segundos.',
                icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
              },
            ].map((item) => (
              <Grid key={item.step} size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    p: { xs: 6, md: 8 },
                    border: `1px solid ${palette.stone800}`,
                    height: '100%',
                    backgroundColor: 'background.paper',
                    transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
                    '&:hover': {
                      borderColor: palette.lime,
                      '& .step-icon': { color: palette.lime },
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{ mb: 6, justifyContent: 'space-between', alignItems: 'flex-start' }}
                  >
                    <Typography
                      sx={{
                        fontFamily: t.fontMono,
                        fontSize: t.size.xs,
                        fontWeight: t.weight.bold,
                        color: palette.lime,
                        letterSpacing: t.tracking.caps,
                      }}
                    >
                      {item.step}
                    </Typography>
                    <Box
                      className="step-icon"
                      sx={{
                        color: 'text.secondary',
                        transition: 'color 250ms ease',
                      }}
                    >
                      {item.icon}
                    </Box>
                  </Stack>

                  <Typography
                    variant="h5"
                    sx={{
                      mb: 2,
                      fontSize: t.size.xl,
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <DhDivider />

      {/* ── CTA ── */}
      <DhSection
        sx={{
          textAlign: 'center',
          borderTop: `1px solid ${palette.stone800}`,
        }}
      >
        <Stack spacing={5} sx={{ alignItems: 'center' }}>
          <DhBadge variant="outline" dot>Ready to build?</DhBadge>

          <Typography
            variant="h2"
            sx={{ fontSize: { xs: t.size['3xl'], md: t.size['5xl'] }, maxWidth: 600 }}
          >
            Tu visión,{' '}
            <Box component="span" sx={{ color: palette.lime }}>
              materializada.
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 440 }}
          >
            Comienza a generar exteriores arquitectónicos de alta calidad hoy mismo. Sin instalaciones, sin fricción.
          </Typography>

          <Link href="/studio" style={{ textDecoration: 'none' }}>
            <DhButton
              variant="contained"
              color="primary"
              size="large"
              iconEnd={<ArrowForwardIcon />}
            >
              Abrir Studio
            </DhButton>
          </Link>
        </Stack>
      </DhSection>

      {/* ── Footer ── */}
      <Box
        component="footer"
        sx={{
          borderTop: `1px solid ${palette.stone800}`,
          py: 8,
          px: { xs: 3, md: 6 },
        }}
      >
        <Container maxWidth="xl" disableGutters>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              gap: 6,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontFamily: t.fontSans,
                  fontSize: t.size['2xl'],
                  fontWeight: t.weight.black,
                  letterSpacing: t.tracking.tightest,
                  textTransform: 'uppercase',
                  mb: 3,
                }}
              >
                DreamHouse AI
              </Typography>
              <Stack direction="row" spacing={4}>
                {['Terms', 'Privacy', 'Contact'].map((item) => (
                  <Typography
                    key={item}
                    component="a"
                    href="#"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: 44,
                      fontFamily: t.fontMono,
                      fontSize: t.size.xs,
                      fontWeight: t.weight.bold,
                      letterSpacing: t.tracking.wider,
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      textDecoration: 'none',
                      '&:hover': { color: palette.lime },
                      transition: 'color 200ms ease',
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Box>

            <Stack spacing={1} sx={{ textAlign: { md: 'right' } }}>
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: t.size.xs,
                  fontWeight: t.weight.bold,
                  color: palette.lime,
                  letterSpacing: t.tracking.wider,
                  textTransform: 'uppercase',
                }}
              >
                Architecture Studio · Bogotá, Colombia
              </Typography>
              <Typography
                sx={{
                  fontFamily: t.fontMono,
                  fontSize: t.size.xs,
                  color: palette.stone600,
                }}
              >
                © 2025 DreamHouse Inc.
              </Typography>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
