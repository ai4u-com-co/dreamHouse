'use client';

import React, { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DhButton } from '@/components/brand';
import { hasLegacyHistory, importLegacyHistory } from '@/lib/db';
import { HISTORY_CHANGED_EVENT } from '@/lib/hooks/useHistory';
import { palette, typography as t } from '@/lib/theme/tokens';

/**
 * El historial anterior (sin dueño) NO se adopta solo: si hay renders guardados antes de iniciar sesión, se pregunta.
 * «Ahora no» no toca nada y se vuelve a preguntar la próxima vez. Importar fusiona (no sobrescribe) y es idempotente.
 */
export default function LegacyHistoryDialog({ ownerId, email }: { ownerId: string | null; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentOwner = useRef<string | null>(ownerId);
  currentOwner.current = ownerId;

  useEffect(() => {
    setOpen(false);
    setError(null);
    if (!ownerId) return;
    let cancelled = false;
    hasLegacyHistory().then((has) => {
      if (!cancelled) setOpen(has);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const handleImport = async () => {
    const owner = ownerId;
    if (!owner) return;
    setBusy(true);
    setError(null);
    try {
      await importLegacyHistory(owner);
      window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
      if (owner === currentOwner.current) setOpen(false);
    } catch (err) {
      console.error('Failed to import legacy history:', err);
      setError('No se pudo importar. Cierra otras pestañas de esta app e inténtalo de nuevo; tu historial anterior sigue intacto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} aria-labelledby="legacy-title" slotProps={{ paper: { sx: { maxWidth: 440, m: 2, border: `1px solid ${palette.stone800}` } } }}>
      <DialogContent data-testid="legacy-dialog">
        <Stack spacing={3} sx={{ textAlign: 'center' }}>
          <Typography id="legacy-title" sx={{ fontFamily: t.fontSans, fontSize: t.size.xl, fontWeight: t.weight.black, textTransform: 'uppercase' }}>
            Encontramos renders anteriores en este navegador
          </Typography>
          <Typography sx={{ fontSize: t.size.sm, color: palette.stone500, lineHeight: 1.6 }}>
            Son de antes de iniciar sesión. ¿Quieres importarlos a tu cuenta ({email})? Si no son tuyos, elige «Ahora no»: no se tocan.
          </Typography>
          {error && (
            <Typography role="alert" sx={{ fontSize: t.size.sm, color: palette.warning }}>
              {error}
            </Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
            <DhButton variant="contained" color="primary" loading={busy} onClick={() => void handleImport()} sx={{ minHeight: 44 }}>
              Importar a mi cuenta
            </DhButton>
            <DhButton variant="outlined" color="primary" disabled={busy} onClick={() => { setOpen(false); setError(null); }} sx={{ minHeight: 44 }}>
              Ahora no
            </DhButton>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
