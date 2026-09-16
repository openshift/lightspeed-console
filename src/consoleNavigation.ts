/**
 * Navigate the host OpenShift console without assuming a specific react-router mount.
 * Works from the Lightspeed modal launched via useModal.
 */
export const navigateToConsolePath = (path: string): void => {
  if (!path || path === '#') {
    return;
  }

  const url = path.startsWith('/') ? path : `/${path}`;

  if (window.history?.pushState) {
    window.history.pushState(window.history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  window.location.assign(url);
};
