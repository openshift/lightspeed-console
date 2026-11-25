import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Match the data-test attribute used in src/ and the e2e tests
configure({ testIdAttribute: 'data-test' });

// Echo the translation key and fill in {{placeholders}} instead of loading the locale files
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
    t: (key: string, options?: Record<string, unknown>) =>
      options ? key.replace(/{{(\w+)}}/g, (_, name) => String(options[name] ?? '')) : key,
  }),
}));
