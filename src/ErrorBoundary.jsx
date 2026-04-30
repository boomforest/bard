import React from 'react'
import { reportError } from './errorReporter'

// Wraps the whole app — catches any React render error, posts a row to
// error_reports, and shows a friendly fallback. The user-facing copy
// is intentionally generic ("an error report has been sent…") because
// we don't want to leak stack traces or surface implementation details.

export default class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportError(error, {
      componentStack: typeof info?.componentStack === 'string'
        ? info.componentStack.slice(0, 4000)
        : null,
    })
  }

  reset = () => this.setState({ hasError: false })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '2rem',
        background: '#08080c', color: '#e8e0d0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{
            fontSize: '0.72rem', color: '#dd22aa', textTransform: 'uppercase',
            letterSpacing: '0.15em', fontWeight: '800', marginBottom: '0.4rem',
          }}>
            Something glitched
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            We're on it.
          </div>
          <div style={{ color: '#8a8098', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.55 }}>
            An error report has been sent to the team for immediate review.
            You can also contact{' '}
            <a href="mailto:jp@casadecopas.com" style={{ color: '#dd22aa', textDecoration: 'none' }}>
              jp@casadecopas.com
            </a>{' '}with concerns.
          </div>
          <button onClick={this.reset} style={{
            background: 'linear-gradient(135deg, #dd22aa, #f07020)', color: '#000',
            border: 'none', borderRadius: '10px', padding: '0.85rem 1.5rem',
            fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Try again
          </button>
        </div>
      </div>
    )
  }
}
