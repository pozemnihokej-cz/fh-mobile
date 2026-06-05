import { useEffect, useState } from 'react';
import { Box, Container, Typography, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { useTranslation } from '@fh/i18n';
import { supabase } from '../lib/supabase';

/**
 * CHANGE-055 Spec-AC-02: root `/` tenant picker.
 *
 * Fetches `tenants` via the anon Supabase client with an explicit
 * `select=id,slug,name` projection filtered by `is_active=true`. Each row
 * is rendered as a plain `<a href="/<slug>/">` so the browser handles
 * navigation through `BrowserRouter` natively (no react-router state
 * carries — refresh-friendly).
 *
 * Rows are sorted by `name` ASC (locale-aware) so the picker is stable
 * regardless of insertion order at the DB.
 */
interface PickerRow {
  id: string;
  slug: string;
  name: string;
}

export default function TenantPickerPage(): JSX.Element {
  const { t } = useTranslation();
  const [rows, setRows] = useState<PickerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: fetchError } = await supabase
        .from('tenants')
        .select('id,slug,name')
        .eq('is_active', true);
      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
        return;
      }
      const list = ((data ?? []) as PickerRow[])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff', py: 4 }}>
      <Container maxWidth="xs">
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, textAlign: 'center' }}>
          {t('mobile.routing.picker.title')}
        </Typography>

        {rows === null && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress color="success" />
          </Box>
        )}

        {rows && rows.length === 0 && !error && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            {t('mobile.routing.picker.empty')}
          </Typography>
        )}

        {error && (
          <Typography variant="body2" sx={{ color: '#ff6b6b', textAlign: 'center' }}>
            {error}
          </Typography>
        )}

        {rows && rows.length > 0 && (
          <List data-testid="tenant-picker-list">
            {rows.map((row) => (
              <ListItem key={row.id} disablePadding sx={{ mb: 1 }}>
                <a
                  href={`/${row.slug}/`}
                  data-testid={`tenant-picker-row-${row.slug}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 16px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                  }}
                >
                  <ListItemText primary={row.name} secondary={row.slug} />
                </a>
              </ListItem>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
}
