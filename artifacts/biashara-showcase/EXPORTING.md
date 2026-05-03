# Refreshing the downloadable PDF and PPTX

The Biashara SACCO marketing landing page (`artifacts/biashara-sacco`) hosts
two download buttons under the **Take the showcase offline** section:

- `Download PDF`  → `/biashara-showcase/exports/biashara-sacco-showcase.pdf`
- `Download PPTX` → `/biashara-showcase/exports/biashara-sacco-showcase.pptx`

Both files are static assets served from this artifact's `public/exports/`
folder. Whenever you edit slides, regenerate the files so the downloads stay
in sync.

## Refresh steps

1. Make sure the showcase workflow is running (`artifacts/biashara-showcase: web`).
2. Ask the agent to re-export the deck — it will use the slides export
   helper to render `/allslides` and write fresh files.
3. Copy the freshly generated files over the ones in
   `artifacts/biashara-showcase/public/exports/`, keeping the same filenames
   so the landing-page links continue to work:

   ```bash
   cp .local/outputs/Biashara-SACCO-Product-Showcase.pdf \
      artifacts/biashara-showcase/public/exports/biashara-sacco-showcase.pdf
   cp .local/outputs/Biashara-SACCO-Product-Showcase.pptx \
      artifacts/biashara-showcase/public/exports/biashara-sacco-showcase.pptx
   ```

4. The showcase dev server picks the new files up automatically. Reload the
   landing page and click the buttons to verify.

## Notes

- Both files render the deck at 16:9 (1920×1080) using the slide components
  in `src/pages/slides/` with the Biashara branding, fonts, and colours from
  `index.html` and `index.css`.
- Filenames in `public/exports/` are intentionally fixed. Do not rename them
  or you will break the landing-page links in
  `artifacts/biashara-sacco/src/pages/landing.tsx`.
- The workspace's built-in slide viewer also exposes PDF / PPTX / Google
  Slides export from its top-right menu — useful for one-off shares without
  touching the committed files.
