# nutri_signatures

> Treść stopki (nagłówki, klauzula, nota eko, certyfikaty) jest po angielsku — Nutri Partners to firma międzynarodowa. Sam generator jest po polsku.

Generator stopek e-mail dla Nutri Partners. Pracownik wpisuje swoje dane (albo wybiera się z listy), wybiera szablon i kopiuje gotową stopkę do Gmaila, Outlooka lub Apple Mail.

## Funkcje

- **logowanie wspólnym kontem Nutri Partners** (Supabase neutralizatora); wejdą administratorzy i osoby z uprawnieniem `signatures` w `profiles.apps`. Konta, reset hasła i uprawnienia są w centrum aplikacji (https://nutripartners.vercel.app → User management); bez dostępu widać komunikat i przycisk „Wszystkie aplikacje”
- **dane z profilu w centrum** (od 21.10.2026): pusty formularz wypełnia się danymi z „My profile” w centrum (imię i nazwisko, stanowisko, dział, telefony, e-mail logowania, LinkedIn, adres biura z listy biur); przycisk „Uzupełnij z mojego profilu” robi to na żądanie. Dane czyta przeglądarka jako zalogowana osoba (`src/lib/profile.ts`: własny wiersz `profiles` i tabela `offices`). Zdjęcia z profilu nie są używane, bo stopka potrzebuje publicznego linku

- 3 szablony: **Nowoczesna**, **Minimalistyczna**, **Baner**
- ikony przy telefonie, e-mailu, stronie i adresie (albo litery — do wyboru)
- odznaki certyfikatów (ISO 9001, Organic Certified) w stopce — do wyłączenia przełącznikiem
- ikony social media (LinkedIn, Instagram, Facebook) pod danymi kontaktowymi; domyślnie profile firmy z `COMPANY_SOCIAL` w `src/lib/signature.ts`
- logo w stopce prowadzi do nutripartners.co (`COMPANY_URL`)
- zdjęcie pracownika, logo, kolor akcentu, nota ekologiczna, klauzula poufności
- podgląd w makiecie maila (komputer / telefon)
- „Kopiuj stopkę” (do wklejenia w ustawieniach podpisu), „Kopiuj HTML”, „Pobierz .htm” (folder podpisów klasycznego Outlooka)
- instrukcje dla Gmaila, Outlooka (nowy, web, klasyczny) i Apple Mail
- dane z formularza zapamiętywane w przeglądarce
- logo i przycisk „Wszystkie aplikacje” w nagłówku prowadzą do centrum aplikacji Nutri Partners (https://nutripartners.vercel.app, zmienna `VITE_HUB_URL`)
- **zapisane stopki**: zapis wielu stopek pod własnymi nazwami, ponowne otwieranie do edycji („Zapisz zmiany” / „Zapisz jako nową”), usuwanie; eksport i import pliku `.json`; po skonfigurowaniu bazy (niżej) lista jest wspólna dla całego zespołu i chroniona hasłem, bez niej zapis jest lokalny, w `localStorage`

Stopka jest zbudowana na tabelach i stylach inline (bez SVG i webfontów), dzięki czemu wygląda tak samo w Gmailu, Outlooku i Apple Mail.

## Lista pracowników

Plik `src/lib/employees.ts`. Każdy wpis to jedna osoba:

```ts
{
  fullName: 'Jan Kowalski',
  position: 'Key Account Manager',
  department: 'Sprzedaż',
  email: 'j.kowalski@nutripartners.co',
  phone: '+48 500 000 000',
  photoUrl: 'https://…/jan-kowalski.jpg',
},
```

Gdy lista nie jest pusta, na górze formularza pojawia się pole „Pracownik” — wybranie osoby wypełnia dane i zdjęcie.

## Certyfikaty

Lista odznak jest w `CERTIFICATES` w `src/lib/signature.ts` (nazwa, ikona, kolor kółka, opcjonalny link). Żeby odznaka była klikalna, dopisz `href`, np. link do PDF certyfikatu na nutripartners.co:

```ts
{ label: 'ISO 9001', icon: 'quality', color: null, href: 'https://nutripartners.co/.../iso-9001.pdf' },
```

To własne, neutralne odznaki w stylu Nutri Partners — nie oficjalne znaki (unijny „Euroliść”, znaki jednostek certyfikujących ISO), które mają własne zasady używania.

## Grafiki (logo i zdjęcia)

Odbiorca pobiera grafiki z sieci przy otwarciu maila, więc linki muszą być **publiczne**.

- **Logo** — `public/logo.png`, 300×58 px (2×) z metadanymi 192 DPI, wyświetlane jako 150×29 px. Podwójna rozdzielczość daje ostre logo na ekranach Retina; 192 DPI sprawia, że Outlook, który w odpowiedziach i przekazanych mailach gubi wymiary obrazka, nadal pokazuje je jako 150×29. Nie wstawiaj większego pliku — rozjechałby się w odpowiedziach. Domyślnie ładowane z adresu, pod którym działa generator (`https://<adres>/logo.png`). Inny adres: zmienna środowiskowa `VITE_EMAIL_LOGO_URL`.
- **Zdjęcia** — kwadratowe, najlepiej 84×84 px, z tego samego powodu.
- **Ikony kontaktowe** — `public/icons/*.png` (telefon, komórka, e-mail, www, adres), białe, pliki 24×24 px (192 DPI) wyświetlane jako 12×12 px, wstawiane w koło w kolorze akcentu, więc jeden zestaw pasuje do każdego koloru. Gdy program pocztowy blokuje obrazki, w kole widać literę (T / M / E / W / A). Ikony można wyłączyć w generatorze („Ikony przy danych kontaktowych”).
- Logo i ikony ładują się domyślnie z adresu, pod którym działa generator. Inny host dla wszystkich grafik: `VITE_EMAIL_ASSETS_URL` (np. `https://nutri-signatures.vercel.app`); samo logo: `VITE_EMAIL_LOGO_URL`.

## Uruchomienie lokalne

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # produkcyjny build do dist/
npm run lint
```

Na `localhost` podgląd pokazuje ostrzeżenie o grafikach — to normalne, odbiorcy nie mają dostępu do Twojego komputera.

## Wspólna baza zapisanych stopek

Zapisane stopki są w tabeli `email_signatures` wspólnej bazy Supabase aplikacji Nutri Partners (ta sama, w której się logujemy). Cały zespół widzi jedną listę na każdym urządzeniu; przy każdej stopce widać, kto zapisał ją ostatnio.

- Schemat (tabela, trigger, RLS) jest w `db/schema.sql` repo `pnedzka/nutri_documentation`. Przeglądarka czyta i zapisuje tabelę sesją zalogowanej osoby (`src/lib/cloud.ts`); row level security wpuszcza administratorów i osoby z `signatures` w `profiles.apps`. Nie ma osobnego hasła zespołu ani klucza serwera.
- Kto i kiedy zapisał (`updated_by`, `updated_by_email`, `updated_at`) ustawia trigger w bazie, nie przeglądarka.
- Zmiany zrobione bez połączenia czekają w przeglądarce i wysyłają się przy następnym połączeniu. Stopki zapisane wcześniej tylko w przeglądarce są wysyłane przy pierwszym połączeniu.
- Bez Supabase albo bez tabeli (np. przed migracją bazy, przy `npm run dev` bez zmiennych) stopki zapisują się tylko w przeglądarce.

Wcześniej lista była w Vercel Blob z hasłem zespołu. 21.10.2026 przeniesiono ją do tabeli (14 stopek), a magazyn i jego kod usunięto.

## Logowanie

- `NEXT_PUBLIC_SUPABASE_URL` = `https://edzjkumjutffodfpasmf.supabase.co` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publiczny klucz anon tego projektu (ustawione w Vercelu dla Production i Preview). Klucz secret nie jest potrzebny: profil czyta się jako zalogowana osoba, a RLS zwraca tylko jej wiersz.
- Lokalnie te same wartości jako `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` w `.env.local`.
- Dostęp: `src/lib/auth.ts` (ekran) i `api/_lib/access.ts` (API zapisanych stopek), identyfikator aplikacji `signatures`.
- **Jedno logowanie przez centrum** (od 18.10.2026): bez sesji aplikacja przekierowuje do centrum (`/sso`), które w razie potrzeby pokazuje logowanie i wraca na tę samą stronę z jednorazowym tokenem w adresie (`#sso=…`, `src/lib/sso.ts`). Wylogowanie tutaj wylogowuje też z centrum (`/logout`). Formularz logowania w aplikacji zostaje jako zapasowy, gdy token nie zadziała.

## Środowiska: dev i produkcja

| | Produkcja | Dev |
| --- | --- | --- |
| Gałąź | `main` | `develop` (i gałęzie PR-ów) |
| Adres | https://nutri-signatures.vercel.app | https://nutri-signatures-git-develop-nutri-partners.vercel.app (tylko po zalogowaniu do Vercela) |
| Baza Supabase | `nutri-documentation` (`edzjkumjutffodfpasmf`) | `nutri-dev` (`xmcwvpgtaxlpswxghuqq`), osobne konta testowe |
| Zmienne w Vercelu | Production | Preview |

W Preview przeglądarka używa `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, a serwer `SUPABASE_URL` / `SUPABASE_ANON_KEY` bazy dev; `VITE_HUB_URL` prowadzi do centrum dev. Zapisane stopki w dev trafiają do tabeli `email_signatures` bazy `nutri-dev`, więc nie zmieniają listy zespołu na produkcji.

1. **Praca:** gałąź od `develop` i PR do `develop` (squash). Każdy PR ma własny podgląd; po scaleniu zmiana jest pod stałym adresem dev.
2. **Wydanie na produkcję** (na polecenie właściciela): PR `develop` → `main`, scalany **merge commitem**, nie squashem, żeby gałęzie się nie rozjechały. Vercel wdraża `main` w ok. minutę. Cofnięcie: Vercel → Deployments → poprzednie wdrożenie → Instant Rollback.
3. **Zmiany schematu bazy:** najpierw na `nutri-dev`, przy wydaniu ta sama zmiana na produkcji, przed scaleniem do `main`. Pełny schemat: `db/schema.sql` w `nutri_documentation`.
4. **Pilna poprawka:** PR do `main`, potem `main` scalić do `develop`.

Darmowa baza dev usypia się po 7 dniach bez użycia. Wybudzenie: Supabase → projekt `nutri-dev` → Restore (ok. minuty).

## Monitorowanie

- Błędy przeglądarki i serwera trafiają do **Sentry** (wspólny projekt aplikacji Nutri Partners, tag `app: signatures`), gdy ustawione są `SENTRY_DSN` (serwer) i `VITE_SENTRY_DSN` (przeglądarka), ta sama wartość, w Production i Preview. Bez nich nic nie jest wysyłane.
- Serwer: `api/_lib/monitoring.ts` (`logError`, `monitored` dla handlerów API: nieoczekiwany błąd → 500 i zgłoszenie). Przeglądarka: `src/lib/monitoring.ts`.
- Do Sentry nie trafiają ciasteczka, nagłówki, treść żądań ani fragment adresu (`#sso=…`). Osobę opisuje id konta i e-mail.
- Szczegóły i alerty: README centrum, „Monitorowanie i błędy”.

## Wdrożenie (Vercel)

1. vercel.com → **Add New → Project** → wybierz repozytorium `nutri_signatures`.
2. Framework zostanie wykryty jako **Vite** — kliknij **Deploy**.
3. Gotowy adres (np. `https://nutri-signatures.vercel.app`) wyślij pracownikom. Logo będzie ładowane z `https://<ten-adres>/logo.png`.
