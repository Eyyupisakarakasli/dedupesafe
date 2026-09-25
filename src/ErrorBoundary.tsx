import { t } from './i18n'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Without this, any throw during render leaves a blank page and the user has no
 * idea the scan died. Nothing is reported anywhere — the message stays local.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="app-container">
        <header>
          <h1>{t("Something went wrong")}</h1>
          <p>{t("The app hit an unexpected error. Your file was never uploaded anywhere.")}</p>
        </header>
        <div className="error-msg" role="alert">{this.state.error.message}</div>
        <button className="scan-btn" onClick={() => { this.setState({ error: null }); location.reload() }}> {t("Start over")} </button>
      </div>
    )
  }
}
