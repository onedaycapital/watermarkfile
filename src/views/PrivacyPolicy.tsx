import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'

export function PrivacyPolicy() {
  return (
    <div
      className="min-h-screen flex flex-col text-white font-sans antialiased"
      style={{
        background: 'linear-gradient(165deg, #0f172a 0%, #1e1b4b 35%, #312e81 60%, #1e293b 100%)',
      }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -15%, rgba(99, 102, 241, 0.2), transparent 50%)' }} />
      <div className="relative flex-1 flex flex-col">
        <header className="px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="text-white/90 hover:text-white font-semibold transition-colors">
            ← Back to WatermarkFile
          </Link>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-slate-400 text-sm mb-8">Effective Date: 15 June 2025</p>

          <div className="prose prose-invert prose-slate max-w-none text-white/90 space-y-6 text-sm leading-relaxed">
            <p>
              WatermarkFile (“we,” “our,” or “us”) respects your privacy and is committed to protecting it. This Privacy Policy explains how we handle information when you use our website and watermarking services (the “Service”).
            </p>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">1. Information We Do Not Collect</h2>
              <p>We are designed to minimize data collection.</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>We do not store uploaded documents</li>
                <li>We do not retain watermarked files</li>
                <li>We do not view or access document contents</li>
                <li>We do not use files for analytics, AI training, or any secondary purpose</li>
              </ul>
              <p className="mt-2">Uploaded files are processed temporarily and automatically deleted immediately after watermarking.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">2. Information We May Collect</h2>
              <p>We collect only the minimum information necessary to operate the website:</p>
              <h3 className="text-base font-medium text-white mt-4 mb-1">a. Usage & Technical Data</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Browser type</li>
                <li>Device type</li>
                <li>Anonymous usage statistics (e.g., page views, load times)</li>
              </ul>
              <p className="mt-2">This data does not include document contents, is not linked to your uploaded files, and is used only to improve site performance and reliability.</p>
              <h3 className="text-base font-medium text-white mt-4 mb-1">b. Optional Contact Information</h3>
              <p>If you choose to contact us, we may collect name, email address, and message content. This information is used only to respond to inquiries.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">3. How We Handle Uploaded Files</h2>
              <p>Uploaded files are:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Transmitted securely using encrypted connections (HTTPS/TLS)</li>
                <li>Processed in a temporary, isolated environment</li>
                <li>Automatically deleted after processing completes or times out</li>
              </ul>
              <p className="mt-2">We do not retain backups, logs, or copies of your files. Once deleted, files cannot be recovered.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">4. Cookies & Analytics</h2>
              <p>We may use minimal cookies or analytics tools to understand general site usage and improve performance. We do not track document contents, track individual users across websites, or use advertising or behavioral tracking cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">5. Data Sharing</h2>
              <p>We do not sell, rent, or share personal data or documents with third parties. We may share limited technical data with infrastructure providers (e.g., hosting or security services) strictly as necessary to operate the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">6. Data Security</h2>
              <p>We use reasonable administrative, technical, and physical safeguards including encrypted data transmission, access controls, and secure infrastructure. No system is 100% secure, but we are committed to protecting user privacy by design.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">7. Children’s Privacy</h2>
              <p>The Service is not intended for children under 13. We do not knowingly collect personal information from children.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">8. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. Updates will be posted on this page with a revised effective date.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">9. Contact Us</h2>
              <p>If you have questions about this Privacy Policy, contact us at <a href="mailto:submit@doc.watermarkfile.com" className="text-violet-300 hover:text-white underline underline-offset-2">submit@doc.watermarkfile.com</a>.</p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
