# Contributing to Anamnesis

Thank you for your interest. This is a small project by a single family maintainer, but contributions are welcome within a clear scope.

## Scope

**Accepted**:
- Bug fixes
- New UI features that fit the "AI does entry, UI does viewing" model
- Additional AI provider setup guides (`docs/setup/*.md`)
- Translations / i18n
- Accessibility improvements
- Performance improvements
- Security improvements (especially in auth and file upload paths)

**Not accepted** (please fork instead):
- Features that change the core model (e.g. "cloud-hosted", "social sharing", "community features")
- Ties to a specific AI vendor (we are model-agnostic)
- Telemetry, analytics, crash reporting to external services
- Authentication changes that weaken existing security (no OAuth flows on top of medical data, please)

## Development setup

See the "Getting started" section of [README.md](README.md).

```bash
# Clone
git clone https://github.com/Veta-one/anamnesis.git
cd anamnesis

# Backend
cd backend
npm install
cp ../.env.example .env
# Fill in .env
npm run init-db
npm start

# Frontend (another terminal)
cd frontend
npm install
npm run dev
```

## Coding conventions

### Backend (Node.js + Express)

- Routes in `src/routes/` — one file per resource
- Services in `src/services/` — cross-resource logic
- Middleware in `src/middleware/`
- Never bypass auth middleware
- Use parameterised SQL — no string concatenation
- Every new table needs audit triggers (see `db.js` for pattern)
- Every new entity table needs `patient_id` column

### Frontend (React + TypeScript)

- **TypeScript strict** — no `any`, no `@ts-ignore`
- **Cross-feature imports forbidden** — only through `shared/`
- **Route-based modals** — see `app/router.tsx` patterns
- **CSS tokens** in `styles/tokens.css` — do not hardcode colours
- **Haptic feedback** on all interactive elements via `haptic()`
- **ESLint + TypeScript check** must pass: `npm run lint && npm run typecheck`

### Commits

Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `security:`.

Examples:
```
feat(plan): add urgent priority badge colour
fix(auth): device revocation now invalidates active sessions
docs(setup): add Gemini CLI guide
```

## Pull request checklist

- [ ] `npm run lint` passes (frontend)
- [ ] `npm run typecheck` passes (frontend)
- [ ] `npm run build` succeeds (frontend)
- [ ] Backend starts without errors (`npm start`)
- [ ] Changes are tested locally
- [ ] New user-facing strings are translatable (if i18n is added)
- [ ] No secrets, tokens, or personal data committed
- [ ] Commit messages follow conventional commits

## Security issues

Do not open a public issue for security vulnerabilities. Contact the maintainer via [Telegram](https://t.me/VETA14) or [email](mailto:veta.dez@gmail.com) directly.

## Licensing

By contributing, you agree your contribution will be licensed under the project's MIT license.
