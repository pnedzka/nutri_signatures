import { useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  Code,
  Copy,
  Download,
  Image as ImageIcon,
  Info,
  Mail,
  Monitor,
  Palette,
  Phone,
  RotateCcw,
  Settings2,
  Share2,
  Smartphone,
  TriangleAlert,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useSignatureStore } from './lib/store';
import { Card, CardBody, CardHeader } from './components/Card';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { Toasts } from './components/Toasts';
import { SavedSignatures } from './components/SavedSignatures';
import { useToast } from './lib/toast';
import {
  ACCENT_PRESETS,
  COMPANY_SOCIAL,
  CERTIFICATES,
  DEFAULT_DISCLAIMER,
  DEFAULT_WEBSITE,
  TEMPLATES,
  buildSignatureDocument,
  buildSignatureHtml,
  buildSignatureText,
  defaultLogoUrl,
  isLocalUrl,
  signatureFileName,
  type SignatureData,
  type SignatureTemplate,
} from './lib/signature';
import { EMPLOYEES, type Employee } from './lib/employees';

function defaults(): SignatureData {
  return {
    fullName: '',
    position: '',
    department: '',
    phone: '',
    mobile: '',
    email: '',
    website: DEFAULT_WEBSITE,
    linkedin: COMPANY_SOCIAL.linkedin,
    instagram: COMPANY_SOCIAL.instagram,
    facebook: COMPANY_SOCIAL.facebook,
    address: '',
    photoUrl: '',
    template: 'modern',
    accent: ACCENT_PRESETS[0].value,
    showLogo: true,
    showDisclaimer: true,
    disclaimer: DEFAULT_DISCLAIMER,
    showEco: false,
    showIcons: true,
    showCerts: true,
    logoUrl: defaultLogoUrl(),
  };
}

// Shown in the preview until the form has a name, so the layout is visible right away.
const SAMPLE: Partial<SignatureData> = {
  fullName: 'Jan Kowalski',
  position: 'Key Account Manager',
  department: 'Sales',
  phone: '+48 500 000 000',
  email: 'j.kowalski@nutripartners.co',
};

function employeeFields(e: Employee): Partial<SignatureData> {
  return {
    fullName: e.fullName,
    position: e.position,
    department: e.department ?? '',
    email: e.email,
    phone: e.phone ?? '',
    mobile: e.mobile ?? '',
    ...(e.linkedin ? { linkedin: e.linkedin } : {}),
    address: e.address ?? '',
    photoUrl: e.photoUrl ?? '',
  };
}

async function copyRichText(html: string, text: string) {
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  // Fallback for browsers without async clipboard: copy a rendered, selected copy of the signature.
  const holder = document.createElement('div');
  holder.innerHTML = html;
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const ok = document.execCommand('copy');
  selection?.removeAllRanges();
  holder.remove();
  if (!ok) throw new Error('copy failed');
}

// ─── Small building blocks ────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <span className="text-[#CC1F1F]">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </CardHeader>
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC1F1F] focus-visible:ring-offset-2 ${
          checked ? 'bg-[#CC1F1F]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  );
}

function TemplateThumb({ id, accent }: { id: SignatureTemplate; accent: string }) {
  const line = (w: string, strong = false) => (
    <div className={`h-1 rounded-full ${strong ? 'bg-gray-700' : 'bg-gray-300'}`} style={{ width: w }} />
  );
  if (id === 'modern') {
    return (
      <div className="flex gap-2 items-start">
        <div className="w-5 h-5 rounded-full bg-gray-200 shrink-0" />
        <div className="pl-2 space-y-1 flex-1" style={{ borderLeft: `2px solid ${accent}` }}>
          {line('70%', true)}
          <div className="h-1 rounded-full w-1/2" style={{ background: accent }} />
          {line('60%')}
          {line('45%')}
        </div>
      </div>
    );
  }
  if (id === 'minimal') {
    return (
      <div className="space-y-1">
        {line('60%', true)}
        {line('45%')}
        <div className="h-0.5 w-4 my-1.5" style={{ background: accent }} />
        {line('90%')}
      </div>
    );
  }
  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="p-1.5 space-y-1">
        {line('60%', true)}
        {line('40%')}
      </div>
      <div className="h-2.5" style={{ background: accent }} />
    </div>
  );
}

const instructions: { id: string; label: string; steps: string[] }[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    steps: [
      'Kliknij „Kopiuj stopkę”.',
      'W Gmailu otwórz ⚙️ Ustawienia → Zobacz wszystkie ustawienia → Ogólne → Podpis.',
      'Utwórz nowy podpis i wklej (Ctrl/Cmd + V).',
      'Ustaw go jako domyślny dla nowych wiadomości i odpowiedzi, a na dole strony kliknij „Zapisz zmiany”.',
    ],
  },
  {
    id: 'outlook',
    label: 'Outlook (nowy / web)',
    steps: [
      'Kliknij „Kopiuj stopkę”.',
      'W Outlooku otwórz Ustawienia → Konta → Podpisy.',
      'Dodaj nowy podpis, nadaj mu nazwę i wklej treść.',
      'Wybierz go jako domyślny dla nowych wiadomości i odpowiedzi, następnie zapisz.',
    ],
  },
  {
    id: 'outlook-classic',
    label: 'Outlook klasyczny',
    steps: [
      'Najprościej: skopiuj stopkę i wklej ją w Plik → Opcje → Poczta → Podpisy.',
      'Alternatywnie pobierz plik .htm i umieść go w folderze %APPDATA%\\Microsoft\\Signatures.',
      'Uruchom ponownie Outlooka i wybierz stopkę w Opcjach → Poczta → Podpisy.',
    ],
  },
  {
    id: 'apple',
    label: 'Apple Mail',
    steps: [
      'Kliknij „Kopiuj stopkę”.',
      'W Mail otwórz Ustawienia → Podpisy i dodaj nowy podpis (+).',
      'Odznacz „Zawsze używaj domyślnej czcionki wiadomości” i wklej stopkę.',
      'Na iPhonie: Ustawienia → Aplikacje → Mail → Podpis i wklej stopkę.',
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function App() {
  const { overrides, update, reset } = useSignatureStore();
  const toast = useToast();
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [guide, setGuide] = useState(instructions[0].id);
  const [copied, setCopied] = useState<'rich' | 'html' | null>(null);

  const data = useMemo<SignatureData>(() => ({ ...defaults(), ...overrides }), [overrides]);
  const isSample = !data.fullName.trim();
  const previewData = useMemo<SignatureData>(() => (isSample ? { ...data, ...SAMPLE } : data), [data, isSample]);
  const html = useMemo(() => buildSignatureHtml(data), [data]);
  const previewHtml = useMemo(() => buildSignatureHtml(previewData), [previewData]);
  const selectedEmployee = EMPLOYEES.findIndex((e) => e.email.toLowerCase() === data.email.trim().toLowerCase());

  const localImage = [
    data.showLogo ? data.logoUrl : '',
    data.photoUrl,
    data.showIcons || data.showCerts || data.linkedin || data.instagram || data.facebook
      ? window.location.origin
      : '',
  ].find((u) => u && isLocalUrl(u));
  const [photoFailed, setPhotoFailed] = useState<string | null>(null);
  const photoBroken = Boolean(data.photoUrl.trim()) && photoFailed === data.photoUrl;
  const emailInvalid = data.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());

  const field = (key: keyof SignatureData) => ({
    value: String(data[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [key]: e.target.value }),
  });

  const flashCopied = (kind: 'rich' | 'html') => {
    setCopied(kind);
    setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2000);
  };

  const handleCopyRich = async () => {
    try {
      await copyRichText(html, buildSignatureText(data));
      flashCopied('rich');
      toast.success('Stopka skopiowana', 'Wklej ją w ustawieniach podpisu swojego programu pocztowego.');
    } catch {
      toast.error('Nie udało się skopiować', 'Zaznacz stopkę w podglądzie i skopiuj ją ręcznie (Ctrl/Cmd + C).');
    }
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      flashCopied('html');
      toast.success('Kod HTML skopiowany');
    } catch {
      toast.error('Nie udało się skopiować kodu HTML');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([buildSignatureDocument(data)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = signatureFileName(data);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    reset();
    toast.info('Formularz wyczyszczony');
  };

  const handleSelectEmployee = (index: number) => {
    if (index < 0) return;
    update(employeeFields(EMPLOYEES[index]));
  };

  const activeGuide = instructions.find((i) => i.id === guide) ?? instructions[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="Nutri Partners" width={150} height={29} className="shrink-0" />
            <span className="hidden sm:block h-5 w-px bg-gray-200" aria-hidden="true" />
            <span className="hidden sm:block text-sm font-medium text-gray-500 truncate">Generator stopek e-mail</span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleReset} className="whitespace-nowrap">
            <RotateCcw size={14} />
            Wyczyść
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Twoja stopka e-mail</h1>
          <p className="text-sm text-gray-500 mt-1">
            Uzupełnij dane, wybierz szablon i wklej gotową stopkę do Gmaila, Outlooka lub Apple Mail.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-6 items-start">
          {/* ── Form ── */}
          <div className="space-y-6">
            <SavedSignatures
              suggestedName={
                data.fullName.trim()
                  ? `${data.fullName.trim()} – ${TEMPLATES.find((t) => t.id === data.template)?.name ?? ''}`
                  : 'Moja stopka'
              }
            />

            {EMPLOYEES.length > 0 && (
              <Section icon={<Users size={16} />} title="Pracownik">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sig-employee" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Wybierz z listy
                  </label>
                  <select
                    id="sig-employee"
                    value={selectedEmployee}
                    onChange={(e) => handleSelectEmployee(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#CC1F1F] focus:border-transparent"
                  >
                    <option value={-1}>— wpisz dane ręcznie —</option>
                    {EMPLOYEES.map((e, i) => (
                      <option key={e.email} value={i}>
                        {e.fullName} · {e.position}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 -mt-2">Dane i zdjęcie wypełnią się automatycznie. Możesz je potem poprawić.</p>
              </Section>
            )}

            <Section icon={<UserIcon size={16} />} title="Dane osobowe">
              <Input id="sig-name" label="Imię i nazwisko" placeholder="Jan Kowalski" {...field('fullName')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input id="sig-position" label="Stanowisko" placeholder="Key Account Manager" {...field('position')} />
                <Input id="sig-department" label="Dział" placeholder="Sales" {...field('department')} />
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Stopka jest po angielsku: stanowisko, dział i adres wpisz po angielsku (np. „Sales”, „…, Poland”).
              </p>
              <div className="flex items-end gap-3">
                <div
                  className="w-[46px] h-[46px] rounded-full bg-gray-100 border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center"
                  aria-hidden="true"
                >
                  {data.photoUrl.trim() && !photoBroken ? (
                    <img
                      src={data.photoUrl.trim()}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setPhotoFailed(data.photoUrl)}
                    />
                  ) : (
                    <ImageIcon size={18} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    id="sig-photo"
                    label="Zdjęcie (link)"
                    placeholder="https://…/zdjecie.jpg"
                    error={photoBroken ? 'Nie udało się wczytać zdjęcia z tego linku' : undefined}
                    {...field('photoUrl')}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Publiczny link do kwadratowego zdjęcia, najlepiej 84×84 px (większe potrafią się powiększyć w odpowiedziach w Outlooku). Puste pole = stopka bez zdjęcia.
              </p>
            </Section>

            <Section icon={<Phone size={16} />} title="Kontakt">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input id="sig-phone" label="Telefon" placeholder="+48 81 000 00 00" {...field('phone')} />
                <Input id="sig-mobile" label="Telefon komórkowy" placeholder="+48 500 000 000" {...field('mobile')} />
              </div>
              <Input
                id="sig-email"
                label="E-mail"
                type="email"
                placeholder="imie.nazwisko@nutripartners.co"
                error={emailInvalid ? 'Nieprawidłowy adres e-mail' : undefined}
                {...field('email')}
              />
              <Input id="sig-website" label="Strona www" placeholder="nutripartners.co" {...field('website')} />
              <Input id="sig-address" label="Adres biura" placeholder="Prof. Ludwika Chmaja 6, 35-021 Rzeszów, Poland" {...field('address')} />
            </Section>

            <Section icon={<Share2 size={16} />} title="Social media">
              <Input id="sig-linkedin" label="LinkedIn" placeholder="linkedin.com/company/…" {...field('linkedin')} />
              <Input id="sig-instagram" label="Instagram" placeholder="instagram.com/…" {...field('instagram')} />
              <Input id="sig-facebook" label="Facebook" placeholder="facebook.com/…" {...field('facebook')} />
              <p className="text-xs text-gray-500 -mt-2">
                Ikony pojawiają się pod danymi kontaktowymi. Domyślnie profile firmy; puste pole = brak ikony.
              </p>
            </Section>

            <Section icon={<Palette size={16} />} title="Wygląd">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Szablon</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Szablon stopki">
                  {TEMPLATES.map((t) => {
                    const active = data.template === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => update({ template: t.id })}
                        title={t.description}
                        className={`text-left rounded-lg border p-2.5 transition-all ${
                          active
                            ? 'border-[#CC1F1F] ring-2 ring-[#CC1F1F]/15 bg-red-50/30'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="h-12 flex flex-col justify-center">
                          <TemplateThumb id={t.id} accent={data.accent} />
                        </div>
                        <p className="text-xs font-semibold text-gray-900 mt-2">{t.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kolor akcentu</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {ACCENT_PRESETS.map((c) => {
                    const active = data.accent.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => update({ accent: c.value })}
                        aria-label={c.name}
                        aria-pressed={active}
                        title={c.name}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                          active ? 'ring-2 ring-offset-2 ring-gray-900' : ''
                        }`}
                        style={{ background: c.value }}
                      >
                        {active && <Check size={14} className="text-white" />}
                      </button>
                    );
                  })}
                  <label
                    className="w-8 h-8 rounded-full border border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden relative"
                    title="Własny kolor"
                  >
                    <span className="sr-only">Własny kolor</span>
                    <span className="text-gray-400 text-xs">+</span>
                    <input
                      type="color"
                      value={data.accent}
                      onChange={(e) => update({ accent: e.target.value.toUpperCase() })}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                  <span className="text-xs text-gray-500 font-mono ml-1">{data.accent}</span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <Switch checked={data.showLogo} onChange={(v) => update({ showLogo: v })} label="Logo Nutri Partners" />
              <Switch
                checked={data.showIcons}
                onChange={(v) => update({ showIcons: v })}
                label="Ikony przy danych kontaktowych"
                hint="Wyłączone: litery T / M / E / W / A"
              />
              <Switch
                checked={data.showCerts}
                onChange={(v) => update({ showCerts: v })}
                label="Certyfikaty"
                hint={CERTIFICATES.map((c) => c.label).join(' · ')}
              />
                <Switch
                  checked={data.showEco}
                  onChange={(v) => update({ showEco: v })}
                  label="Nota ekologiczna"
                  hint="„Pomyśl o środowisku, zanim wydrukujesz…”"
                />
                <Switch
                  checked={data.showDisclaimer}
                  onChange={(v) => update({ showDisclaimer: v })}
                  label="Klauzula poufności"
                />
                {data.showDisclaimer && (
                  <textarea
                    {...field('disclaimer')}
                    rows={4}
                    aria-label="Treść klauzuli poufności"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#CC1F1F] focus:border-transparent resize-y"
                  />
                )}
              </div>
            </Section>

            <Section icon={<Settings2 size={16} />} title="Zaawansowane">
              <Input id="sig-logo" label="Logo (link)" placeholder="https://…/email/logo.png" {...field('logoUrl')} />
              <p className="text-xs text-gray-500 -mt-2">
                Plik musi mieć dokładnie 150×29 px, inaczej w odpowiedziach na maile logo może się wyświetlić w pełnym
                rozmiarze. Link musi być publiczny, aby odbiorcy widzieli grafikę.
              </p>
            </Section>
          </div>

          {/* ── Preview & actions ── */}
          <div className="space-y-6 xl:sticky xl:top-0">
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Podgląd</h3>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5" role="group" aria-label="Rozmiar podglądu">
                  {(
                    [
                      ['desktop', <Monitor size={14} key="d" />, 'Komputer'],
                      ['mobile', <Smartphone size={14} key="m" />, 'Telefon'],
                    ] as const
                  ).map(([id, icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDevice(id)}
                      aria-pressed={device === id}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        device === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <div className="bg-gray-50 p-4 sm:p-6">
                <div
                  className={`mx-auto bg-white rounded-xl border border-gray-200 shadow-sm transition-all ${
                    device === 'mobile' ? 'max-w-[375px]' : 'max-w-[720px]'
                  }`}
                >
                  <div className="px-5 py-3 border-b border-gray-100 space-y-1 text-xs">
                    <p className="text-gray-500">
                      <span className="inline-block w-16 text-gray-400">From:</span>
                      <span className="text-gray-900 font-medium">{previewData.fullName}</span>{' '}
                      {previewData.email && <span className="text-gray-500">&lt;{previewData.email}&gt;</span>}
                    </p>
                    <p className="text-gray-500">
                      <span className="inline-block w-16 text-gray-400">Subject:</span>
                      <span className="text-gray-900">Cooperation proposal</span>
                    </p>
                  </div>
                  <div className="px-5 py-5 overflow-x-auto">
                    <div className="text-sm text-gray-700 space-y-3 mb-6">
                      <p>Dear Mr Smith,</p>
                      <p>following our conversation, please find the details of our offer attached.</p>
                      <p>Kind regards,</p>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </div>
              </div>

              {isSample && (
                <div className="flex items-start gap-2 px-6 py-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-800">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <p>Podgląd pokazuje przykładowe dane. Wpisz imię i nazwisko, aby zobaczyć swoją stopkę.</p>
                </div>
              )}

              {localImage && (
                <div className="flex items-start gap-2 px-6 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800">
                  <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                  <p>
                    Grafika jest ładowana z <span className="font-mono break-all">{localImage}</span> — odbiorcy jej
                    nie zobaczą. Użyj publicznego linku.
                  </p>
                </div>
              )}

              <CardBody className="flex flex-wrap gap-2 border-t border-gray-100">
                <Button onClick={handleCopyRich} disabled={!data.fullName.trim()}>
                  {copied === 'rich' ? <Check size={16} /> : <Copy size={16} />}
                  {copied === 'rich' ? 'Skopiowano!' : 'Kopiuj stopkę'}
                </Button>
                <Button variant="secondary" onClick={handleCopyHtml} disabled={!data.fullName.trim()}>
                  {copied === 'html' ? <Check size={16} /> : <Code size={16} />}
                  Kopiuj HTML
                </Button>
                <Button variant="secondary" onClick={handleDownload} disabled={!data.fullName.trim()}>
                  <Download size={16} />
                  Pobierz .htm
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center gap-2">
                <Mail size={16} className="text-[#CC1F1F]" />
                <h3 className="text-sm font-semibold text-gray-900">Jak dodać stopkę?</h3>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-1 mb-4" role="tablist" aria-label="Program pocztowy">
                  {instructions.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      role="tab"
                      aria-selected={guide === i.id}
                      onClick={() => setGuide(i.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        guide === i.id ? 'bg-[#CC1F1F] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
                <ol className="space-y-2.5" role="tabpanel">
                  {activeGuide.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-[#CC1F1F]/10 text-[#CC1F1F] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        Nutri Partners · generator stopek e-mail
      </footer>

      <Toasts />
    </div>
  );
}
