# Contributing to Twilio SMS Tester

Thanks for considering contributing! Here's how you can help.

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Run the dev server: `npm run dev`

## How to Contribute

### Bug Reports
- Open an issue with a clear description
- Include steps to reproduce the bug
- Mention your Node.js version and OS

### Feature Requests
- Open an issue describing the feature
- Explain the use case and why it's useful

### Pull Requests
1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally to make sure nothing breaks
4. Commit with a clear message: `git commit -m "Add: your feature"`
5. Push and open a PR

## Code Guidelines

- **No frameworks** — the frontend is intentionally vanilla HTML/CSS/JS
- **Keep it simple** — this is a developer tool, not a production app
- **Security first** — never log or expose auth tokens
- Follow the existing code style (2-space indent, single quotes in JS)

## Project Structure

```
server.js          → Express server entry point
routes/clients.js  → Client CRUD operations
routes/sms.js      → SMS send, logs, webhooks
utils/storage.js   → Encrypted file storage
public/            → Frontend SPA
```

## Questions?

Open an issue — happy to help!
