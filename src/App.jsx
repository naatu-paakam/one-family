import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Header from './components/Header'
import Home from './pages/Home'
import EventDetail from './pages/EventDetail'
import Admin from './pages/Admin'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <footer className="text-center py-6 text-stone-400 text-sm border-t border-stone-200 mt-8">
            © {new Date().getFullYear()} NaatuPaakam · Built with ❤️ for the family
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
