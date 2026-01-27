/* global Cypress, cy, afterEach */
import './commands';
import { register } from '@cypress/grep';

register();

// Collect browser console errors and warnings for output after each test
const browserLogs = [];

Cypress.on('window:before:load', (win) => {
  // Prevent the guided tour popup from appearing in all tests
  const settings = {
    'console.guidedTour': {
      admin: {
        completed: true,
      },
    },
  };
  win.localStorage.setItem('console-user-settings', JSON.stringify(settings));

  // Capture browser console errors and warnings
  ['error', 'warn'].forEach((method) => {
    const original = win.console[method].bind(win.console);
    win.console[method] = (...args) => {
      const msg = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ');
      browserLogs.push({ method, msg });
      original(...args);
    };
  });
});

// Output collected browser logs to terminal after each test
afterEach(() => {
  if (browserLogs.length > 0) {
    browserLogs.forEach(({ method, msg }) => {
      cy.task('log', `[console.${method}] ${msg}`, { log: false });
    });
    browserLogs.length = 0;
  }
});
