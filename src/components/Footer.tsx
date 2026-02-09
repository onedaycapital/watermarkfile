import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-black/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} WatermarkFile. All rights reserved.</span>
          <nav className="flex items-center gap-6">
            <Link
              to="/privacy-policy"
              className="text-slate-400 hover:text-white transition-colors duration-200 underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-use"
              className="text-slate-400 hover:text-white transition-colors duration-200 underline-offset-2 hover:underline"
            >
              Terms of Use
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
