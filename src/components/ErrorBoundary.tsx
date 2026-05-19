import * as React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { isError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { isError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`Caught OpenShift Lightspeed plugin error:
Message: "${error?.message}"
Stack:
${error?.stack}`);

    return { isError: true };
  }

  render() {
    return this.state.isError ? null : this.props.children;
  }
}

export default ErrorBoundary;
