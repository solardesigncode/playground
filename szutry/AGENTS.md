<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system

Before writing any UI, read `DESIGN.md` (Notion-inspired tokens via `getdesign`). Use the documented color/typography/radius/shadow tokens. Re-export tokens from `src/app/globals.css`. Keep buttons rectangular at `--radius-md` (8px), cards at `--radius-lg` (12px), and pills/badges at `--radius-full`.
