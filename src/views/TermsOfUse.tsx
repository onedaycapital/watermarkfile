import { Link } from 'react-router-dom'
import { Footer } from '../components/Footer'

export function TermsOfUse() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Use</h1>
          <p className="text-slate-400 text-sm mb-8">Effective Date: 15 June 2025</p>

          <div className="prose prose-invert prose-slate max-w-none text-white/90 space-y-6 text-sm leading-relaxed">
            <p>
              By accessing or using WatermarkFile (the “Service”), you agree to these Terms of Use (“Terms”). If you do not agree, do not use the Service.
            </p>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">1. Description of Service</h2>
              <p>WatermarkFile provides a tool to apply watermarks to user-uploaded documents. Files are processed temporarily and deleted automatically after watermarking.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">2. User Responsibilities</h2>
              <p>By using the Service, you agree that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You own or have rights to upload the files you submit</li>
                <li>You will not upload unlawful, infringing, or malicious content</li>
                <li>You are responsible for the documents you upload and how you use the output</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">3. File Handling Disclaimer</h2>
              <p>The Service is provided on an “as-is” and “as-available” basis. While we take reasonable steps to process files securely:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>We do not guarantee uninterrupted service</li>
                <li>We are not responsible for file corruption caused by unsupported formats, browser issues, or user error</li>
              </ul>
              <p className="mt-2">You are responsible for keeping your own backups.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">4. No File Retention</h2>
              <p>We do not store files after processing. Once deleted, files cannot be recovered. By using the Service, you acknowledge and accept this design choice.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">5. Intellectual Property</h2>
              <p>You retain all rights to your uploaded documents. We claim no ownership over uploaded files or watermarked outputs. All site content, branding, and software are owned by WatermarkFile and may not be copied without permission.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">6. Prohibited Use</h2>
              <p>You may not attempt to reverse engineer or abuse the Service, upload harmful or illegal content, or interfere with system security or availability. We reserve the right to restrict access for misuse.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">7. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, WatermarkFile is not liable for indirect, incidental, or consequential damages. Our total liability will not exceed the amount paid for the Service (if any).</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">8. Indemnification</h2>
              <p>You agree to indemnify and hold harmless WatermarkFile from claims arising from your uploaded content, your misuse of the Service, or violation of these Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">9. Modifications</h2>
              <p>We may update these Terms at any time. Continued use of the Service constitutes acceptance of updated Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">10. Governing Law</h2>
              <p>These Terms are governed by the laws of the United States and the State of [Your State], without regard to conflict-of-law principles.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mt-8 mb-2">11. Contact</h2>
              <p>Questions about these Terms? Contact us at <a href="mailto:submit@watermarkfile.com" className="text-violet-300 hover:text-white underline underline-offset-2">submit@watermarkfile.com</a>.</p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
