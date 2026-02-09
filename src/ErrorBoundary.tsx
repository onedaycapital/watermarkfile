import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('WatermarkFile render error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 600,
            margin: '40px auto',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 18, color: '#b91c1c' }}>
            Something went wrong
          </h1>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              overflow: 'auto',
              color: '#991b1b',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: '#7f1d1d' }}>
            Check the browser console for details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
