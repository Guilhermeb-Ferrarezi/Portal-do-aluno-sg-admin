import { useEffect } from 'react';

const SETTINGS_KEY = 'perfil_settings';

type Theme = 'sistema' | 'claro' | 'escuro';

export function useTheme() {
  useEffect(() => {
    // Load theme preference from settings
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    let theme: Theme = 'sistema';
    let compact = false;

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        theme = settings.temaPreferido || 'sistema';
        compact = !!settings.modoCompacto;
        applyPrimaryColor(settings.corPreferida || '#e11d2e');
      } catch (e) {
        console.error('Erro ao carregar tema:', e);
      }
    } else {
      applyPrimaryColor('#e11d2e');
    }

    // Apply theme
    applyTheme(theme);
    applyCompact(compact);

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY && e.newValue) {
        try {
          const settings = JSON.parse(e.newValue);
          applyTheme(settings.temaPreferido || 'sistema');
          applyCompact(!!settings.modoCompacto);
          applyPrimaryColor(settings.corPreferida || '#e11d2e');
        } catch (err) {
          console.error('Erro ao aplicar tema:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event when settings are saved in same tab
    const handleSettingsChange = (e: any) => {
      const theme = e.detail?.temaPreferido || 'sistema';
      applyTheme(theme);
      applyCompact(!!e.detail?.modoCompacto);
      applyPrimaryColor(e.detail?.corPreferida || '#e11d2e');
    };

    window.addEventListener('perfil-settings-changed', handleSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('perfil-settings-changed', handleSettingsChange);
    };
  }, []);
}

function normalizeHexColor(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  return '#e11d2e';
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex).slice(1);
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixColor(hex: string, target: { r: number; g: number; b: number }, weight: number) {
  const { r, g, b } = hexToRgb(hex);
  const w = Math.min(1, Math.max(0, weight));
  const nr = Math.round(r + (target.r - r) * w);
  const ng = Math.round(g + (target.g - g) * w);
  const nb = Math.round(b + (target.b - b) * w);
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function applyPrimaryColor(color: string) {
  const html = document.documentElement;
  const base = normalizeHexColor(color);
  const dark = base;
  const light = mixColor(base, { r: 255, g: 255, b: 255 }, 0.9);
  const rgb = hexToRgb(base);

  html.style.setProperty('--primary', base);
  html.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  html.style.setProperty('--primary-dark', dark);
  html.style.setProperty('--primary-light', light);
  html.style.setProperty('--red', base);
  html.style.setProperty(
    '--shadow-colored',
    `0 10px 15px -3px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15), 0 4px 6px -4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
  );
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;

  if (theme === 'escuro') {
    html.setAttribute('data-theme', 'dark');
    html.style.colorScheme = 'dark';
  } else if (theme === 'claro') {
    html.removeAttribute('data-theme');
    html.style.colorScheme = 'light';
  } else {
    // sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.setAttribute('data-theme', 'dark');
      html.style.colorScheme = 'dark';
    } else {
      html.removeAttribute('data-theme');
      html.style.colorScheme = 'light';
    }
  }
}

function applyCompact(compact: boolean) {
  const html = document.documentElement;
  if (compact) {
    html.setAttribute('data-compact', 'true');
  } else {
    html.removeAttribute('data-compact');
  }
}
