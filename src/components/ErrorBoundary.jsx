import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-center py-20 text-stone-400">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="font-medium text-stone-600">Something went wrong</p>
          <p className="text-sm mt-1">{this.state.error.message}</p>
          <button
            className="mt-4 text-brand-600 underline text-sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
