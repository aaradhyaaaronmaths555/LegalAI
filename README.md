# LegalAI

AI-powered legal document analysis, contract review, and legal research.

## Features

- **Document Analysis** — Upload contracts and legal documents for AI-powered extraction and summarization
- **Legal Research** — Ask questions in plain language and get grounded legal insights
- **Contract Review** — Identify risks, non-standard terms, and missing clauses

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment**

   ```bash
   cp .env.example .env.local
   ```

   Add your API keys (OpenAI or Anthropic) to `.env.local` when you're ready to enable AI features.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
  analyze/     # Document upload & analysis
  research/    # Legal research chat
  login/       # Auth (placeholder)
  register/    # Auth (placeholder)
```

## License

Private — All rights reserved.
