/* global Cypress */
import './commands';
import registerCypressGrep from '@cypress/grep';

registerCypressGrep();

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
});
