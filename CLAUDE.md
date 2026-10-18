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
- Wydanie tylko po „wdrażaj”: PR `develop` → `main` scalany merge commitem, potem sprawdzić wdrożenie produkcyjne.

## Praca z repo

- PR-y idą do `develop` (squash). Na produkcję tylko na polecenie właściciela, zob. „Środowiska” wyżej.
- Sandbox Claude Code nie łączy się z supabase.co ani *.vercel.app. Używaj narzędzi MCP: Supabase, Vercel.
