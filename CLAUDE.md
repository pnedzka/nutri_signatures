# CLAUDE.md: kontekst projektu

Repo `pnedzka/nutri_signatures`. Opis funkcji i wdrożenia jest w `README.md`; zasady wspólne dla aplikacji Nutri Partners są w `CLAUDE.md` repo `pnedzka/nutri_hub` (centrum aplikacji).

Właściciel: Paweł Nędzka. Rozmawiamy po polsku.

## Środowiska: dev i produkcja (od 18.10.2026)

Wspólne zasady, zmienne, procedura wydań i pułapki są w `CLAUDE.md` repo `pnedzka/nutri_hub` (sekcja „Środowiska”). Skrót dla tej aplikacji:

| | Produkcja | Dev |
| --- | --- | --- |
| Gałąź | `main` | `develop` i gałęzie PR-ów |
| Adres | https://nutri-signatures.vercel.app | https://nutri-signatures-git-develop-nutri-partners.vercel.app (tylko po zalogowaniu do Vercela) |
| Supabase | `nutri-documentation` (`edzjkumjutffodfpasmf`) | `nutri-dev` (`xmcwvpgtaxlpswxghuqq`), konto testowe `p.nedzka@nutripartners.co` |
| Zmienne w Vercelu | Production | Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (baza dev), `VITE_HUB_URL` (centrum dev) |

- `BLOB_READ_WRITE_TOKEN` jest tylko w Production i Development. W dev zapisane stopki zostają więc w przeglądarce i nie zmieniają wspólnej listy zespołu. Nie dodawać go do Preview.
- Wspólną listę zapisanych stopek widzi każdy z dostępem do generatora (logowanie + `signatures`). Hasło zespołu (`TEAM_PASSWORD`) usunięte 21.10.2026: przeglądarka pamiętała je osobno, więc osoby bez hasła widziały tylko własną, lokalną listę.
- Wydanie tylko po „wdrażaj”: PR `develop` → `main` scalany merge commitem, potem sprawdzić wdrożenie produkcyjne.

## Monitorowanie (od 20.10.2026)

- Sentry: `SENTRY_DSN` + `VITE_SENTRY_DSN` w Production i Preview; na serwerze `logError` zamiast `console.error`, handlery API opakowane w `monitored` (`api/_lib/monitoring.ts`). Całość opisuje README centrum, „Monitorowanie i błędy”.

## Praca z repo

- PR-y idą do `develop` (squash). Na produkcję tylko na polecenie właściciela, zob. „Środowiska” wyżej.
- **Code review automatyczne** (od 20.10.2026): `.github/workflows/claude-code-review.yml` (GitHub Actions, `anthropics/claude-code-action`, plugin `code-review`) komentuje PR, gdy przestaje być szkicem (Ready for review) i po kolejnych pushach; nie blokuje scalania. PR-y wydań (`develop` → `main`) i synchronizacji (`main` → `develop`) pomija. Potrzebuje sekretu repo `ANTHROPIC_API_KEY` (GitHub → Settings → Secrets and variables → Actions, wpisuje właściciel) i aplikacji Claude na GitHubie. Akcja działa tylko wtedy, gdy plik workflow jest identyczny na `main` (domyślna gałąź), więc jego zmiany wprowadza się na `main`.
- Sandbox Claude Code nie łączy się z supabase.co ani *.vercel.app. Używaj narzędzi MCP: Supabase, Vercel.
