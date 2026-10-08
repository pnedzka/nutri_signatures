# nutri_signatures

> Treść stopki (nagłówki, klauzula, nota eko, certyfikaty) jest po angielsku — Nutri Partners to firma międzynarodowa. Sam generator jest po polsku.

Generator stopek e-mail dla Nutri Partners. Pracownik wpisuje swoje dane (albo wybiera się z listy), wybiera szablon i kopiuje gotową stopkę do Gmaila, Outlooka lub Apple Mail.

## Funkcje

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

Zapisane stopki trafiają do prywatnego magazynu Vercel Blob (plik `signatures/<id>.json` na stopkę) przez funkcję `api/signatures.ts`, więc cały zespół widzi tę samą listę na każdym urządzeniu. Dostęp wymaga hasła zespołu.

1. Vercel → projekt → **Storage** → **Create** → **Blob** z dostępem **Private**, podłączony do projektu. Vercel doda zmienną `BLOB_READ_WRITE_TOKEN`.
2. **Settings → Environment Variables**: `TEAM_PASSWORD` z hasłem zespołu (zmiana hasła = edycja tej zmiennej i ponowne wdrożenie).
3. Wdróż ponownie (Deployments → Redeploy), bo zmienne działają od następnego wdrożenia.

Bez tych zmiennych (i przy `npm run dev`) generator działa jak wcześniej: stopki zapisują się tylko w przeglądarce. Przy pierwszym połączeniu stopki zapisane wcześniej w przeglądarce są wysyłane do bazy. Zmiany zrobione bez połączenia czekają w przeglądarce i wysyłają się przy następnym połączeniu.

## Wdrożenie (Vercel)

1. vercel.com → **Add New → Project** → wybierz repozytorium `nutri_signatures`.
2. Framework zostanie wykryty jako **Vite** — kliknij **Deploy**.
3. Gotowy adres (np. `https://nutri-signatures.vercel.app`) wyślij pracownikom. Logo będzie ładowane z `https://<ten-adres>/logo.png`.
