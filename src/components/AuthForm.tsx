import { useState, type FormEvent } from 'react';
import { Box, TextField, Button, Typography, Alert, alpha, useTheme } from '@mui/material';
import { FhIcon, focusRing } from '@fh/ui';
import { useAuth } from '@fh/auth';
import { useTranslation } from '@fh/i18n';

type Mode = 'signin' | 'register';

/**
 * SPEC-PRD-034 Spec-AC-13 — fan register/login form. Email + password, with an
 * optional name on register and a toggle between the two modes. Submit calls
 * `useAuth().signIn` / `signUp` (shared GoTrue) — `signUp` yields an instant
 * session (no admin approval / pending gate). There is NO login wall: this form
 * only ever mounts on the Profile tab; anonymous browsing stays fully intact.
 */
export function AuthForm(): JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await signUp(email, password, name.trim() || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError((err as Error)?.message || t('mobile.fan.auth.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha(theme.palette.common.white, 0.04),
      borderRadius: '12px',
      color: 'common.white',
    },
  } as const;

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      data-testid="auth-form"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        p: 2.25,
        borderRadius: '18px',
        bgcolor: alpha(theme.palette.common.white, 0.03),
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: 'primary.main',
          }}
        >
          <FhIcon name="settings" />
        </Box>
        <Typography sx={{ fontWeight: 800, color: 'common.white' }}>
          {isRegister ? t('mobile.fan.auth.register') : t('mobile.fan.auth.signIn')}
        </Typography>
      </Box>

      {isRegister && (
        <TextField
          data-testid="auth-name"
          label={t('mobile.fan.auth.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          fullWidth
          size="small"
          sx={fieldSx}
        />
      )}

      <TextField
        data-testid="auth-email"
        type="email"
        label={t('mobile.fan.auth.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        fullWidth
        size="small"
        sx={fieldSx}
      />

      <TextField
        data-testid="auth-password"
        type="password"
        label={t('mobile.fan.auth.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        required
        fullWidth
        size="small"
        sx={fieldSx}
      />

      {error && (
        <Alert severity="error" variant="outlined" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      <Button
        data-testid="auth-submit"
        type="submit"
        variant="contained"
        color="primary"
        disabled={busy}
        startIcon={<FhIcon name="confirm" inline />}
        sx={{ borderRadius: '12px', fontWeight: 800, py: 1.1, ...focusRing(theme) }}
      >
        {busy
          ? t('mobile.fan.auth.working')
          : isRegister
            ? t('mobile.fan.auth.register')
            : t('mobile.fan.auth.signIn')}
      </Button>

      <Button
        data-testid="auth-mode-toggle"
        type="button"
        variant="text"
        onClick={() => {
          setError(null);
          setMode(isRegister ? 'signin' : 'register');
        }}
        sx={{ color: 'text.secondary', textTransform: 'none', ...focusRing(theme) }}
      >
        {isRegister ? t('mobile.fan.auth.toSignIn') : t('mobile.fan.auth.toRegister')}
      </Button>
    </Box>
  );
}
