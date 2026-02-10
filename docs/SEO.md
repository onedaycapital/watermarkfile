# SEO setup (WatermarkFile)

Meta tags and structured data are in **`index.html`** to support organic search and social sharing.

## What’s in place

- **Title & description** — Keyword-rich, mentions use cases (PDF/image watermark, bank statements, legal docs, contracts, IDs, photos) and audiences (bankers, brokers, lenders, lawyers, photographers, influencers).
- **Keywords** — Long-tail terms: watermark PDF, watermark image, free watermark tool, watermark bank statement, legal documents, etc.
- **Open Graph** — `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name` for Facebook/LinkedIn/social.
- **Twitter Card** — `summary_large_image` with title, description, image.
- **Canonical URL** — `https://www.watermarkfile.com/`.
- **Robots** — `index, follow`.
- **JSON-LD** — `WebApplication` schema with name, description, URL, category, free offer, feature list, and audience type.
- **Noscript** — Short text + link for non-JS crawlers and readers.
- **Mobile** — `theme-color`, apple-mobile-web-app meta.

## Recommended next steps for high traffic

1. **OG/Twitter image**  
   Use a dedicated **1200×630** image for `og:image` and `twitter:image` (e.g. logo + tagline on a branded background). Replace the current image path in `index.html` or add `og-image.png` to `public/` and point both tags to it.

2. **Sitemap**  
   Add `public/sitemap.xml` with your production URL (e.g. `https://www.watermarkfile.com/`). For a single-page app one URL is enough. Submit in Google Search Console.

3. **robots.txt**  
   Add `public/robots.txt`:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://www.watermarkfile.com/sitemap.xml
   ```

4. **Search Console & Analytics**  
   Verify the domain in Google Search Console and (if you use it) Bing Webmaster Tools. Keep Amplitude or add Google Analytics for traffic and queries.

5. **Performance**  
   Keep Core Web Vitals healthy (LCP, FID, CLS). Vite’s build is already optimized; watch for large images or fonts if you add more assets.

6. **HTTPS & canonical**  
   Serve the site over HTTPS and keep the canonical in `index.html` in sync with your live domain (e.g. if you use a different host than www.watermarkfile.com, update the canonical and OG/Twitter URLs).

## Changing the domain

If the live site uses a different base URL, search and replace in `index.html`:

- `https://www.watermarkfile.com` → your real base URL (e.g. `https://watermarkfile.vercel.app`).

Apply the same URL in:

- `canonical`
- `og:url`, `og:image`
- `twitter:url`, `twitter:image`
- JSON-LD `url`
- `noscript` link and any `sitemap`/`robots.txt` URLs.
