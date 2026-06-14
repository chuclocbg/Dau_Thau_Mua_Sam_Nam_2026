import React from 'react';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class DocErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DocErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '1rem',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '6px',
          background: 'rgba(239,68,68,0.08)',
          color: '#fca5a5',
          fontSize: '0.82rem',
        }}>
          <b>[LỖI KỸ THUẬT]</b> {this.props.fallbackLabel ?? 'Không thể hiển thị văn bản này.'}<br />
          <span style={{ opacity: 0.7 }}>{this.state.errorMessage}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
