# nutri_signatures

Generator stopek e-mail dla Nutri Partners. Pracownik wpisuje swoje dane (albo wybiera się z listy), wybiera szablon i kopiuje gotową stopkę do Gmaila, Outlooka lub Apple Mail.

## Funkcje

- 3 szablony: **Nowoczesna**, **Minimalistyczna**, **Baner**
- zdjęcie pracownika, logo, kolor akcentu, nota ekologiczna, klauzula poufności
- podgląd w makiecie maila (komputer / telefon)
- „Kopiuj stopkę” (do wklejenia w ustawieniach podpisu), „Kopiuj HTML”, „Pobierz .htm” (folder podpisów klasycznego Outlooka)
- instrukcje dla Gmaila, Outlooka (nowy, web, klasyczny) i Apple Mail
- dane z formularza zapamiętywane w przeglądarce

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

## Grafiki (logo i zdjęcia)

Odbiorca pobiera grafiki z sieci przy otwarciu maila, więc linki muszą być **publiczne**.

- **Logo** — `public/logo.png`, dokładnie 150×29 px. Rozmiar pliku = rozmiar w stopce, bo Outlook i część innych programów gubią wymiary obrazka w odpowiedziach i przekazanych mailach (większy plik rozjechałby się do pełnego rozmiaru). Domyślnie ładowane z adresu, pod którym działa generator (`https://<adres>/logo.png`). Inny adres: zmienna środowiskowa `VITE_EMAIL_LOGO_URL`.
- **Zdjęcia** — kwadratowe, najlepiej 84×84 px, z tego samego powodu.

## Uruchomienie lokalne

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # produkcyjny build do dist/
npm run lint
```

Na `localhost` podgląd pokazuje ostrzeżenie o grafikach — to normalne, odbiorcy nie mają dostępu do Twojego komputera.

## Wdrożenie (Vercel)

1. vercel.com → **Add New → Project** → wybierz repozytorium `nutri_signatures`.
2. Framework zostanie wykryty jako **Vite** — kliknij **Deploy**.
3. Gotowy adres (np. `https://nutri-signatures.vercel.app`) wyślij pracownikom. Logo będzie ładowane z `https://<ten-adres>/logo.png`.
