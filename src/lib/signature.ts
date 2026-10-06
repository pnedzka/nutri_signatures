// Email signature generator.
// Output must survive Gmail, Outlook (incl. classic desktop/Word engine) and Apple Mail,
// so everything is table-based with inline styles, web-safe fonts and PNG images only (no SVG).

export type SignatureTemplate = 'modern' | 'minimal' | 'banner';

export interface SignatureData {
  fullName: string;
  position: string;
  department: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  linkedin: string;
  address: string;
  photoUrl: string;
  template: SignatureTemplate;
  accent: string;
  showLogo: boolean;
  showDisclaimer: boolean;
  disclaimer: string;
  showEco: boolean;
  logoUrl: string;
}

export const COMPANY_NAME = 'Nutri Partners';

export const DEFAULT_WEBSITE = 'nutripartners.co';

export const DEFAULT_DISCLAIMER =
  'Ta wiadomość wraz z załącznikami może zawierać informacje poufne, przeznaczone wyłącznie dla adresata. ' +
  'Jeżeli nie jesteś zamierzonym odbiorcą, prosimy o niezwłoczne powiadomienie nadawcy i usunięcie wiadomości. ' +
  'Wszelkie rozpowszechnianie, kopiowanie lub wykorzystywanie jej treści jest zabronione.';

export const ECO_NOTE = 'Pomyśl o środowisku, zanim wydrukujesz tę wiadomość.';

export const ACCENT_PRESETS = [
  { name: 'Bordo Nutri', value: '#A50029' },
  { name: 'Czerwień', value: '#CC1F1F' },
  { name: 'Grafit', value: '#111827' },
  { name: 'Zieleń', value: '#2F7D4F' },
] as const;

export const TEMPLATES: { id: SignatureTemplate; name: string; description: string }[] = [
  { id: 'modern', name: 'Nowoczesna', description: 'Akcent pionowy, zdjęcie i logo w stopce' },
  { id: 'minimal', name: 'Minimalistyczna', description: 'Lekka, tekstowa, jedna linia kontaktów' },
  { id: 'banner', name: 'Baner', description: 'Karta z kolorowym paskiem marki' },
];

/**
 * Logo cropped to exactly its display size (public/logo.png, 150×29 px). Some clients (notably Outlook)
 * drop width/height on replies and forwards; a larger file would then blow up to its native size.
 * Override with VITE_EMAIL_LOGO_URL to load the same file from another public host.
 */
export function defaultLogoUrl(): string {
  const fromEnv = import.meta.env.VITE_EMAIL_LOGO_URL as string | undefined;
  if (fromEnv) return fromEnv;
  return typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '';
}

export function isLocalUrl(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(url.trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const FONT = 'Arial, Helvetica, sans-serif';
const TEXT = '#111827';
const BODY = '#374151';
const MUTED = '#6B7280';
const FAINT = '#9CA3AF';
const BORDER = '#E5E7EB';

// Must match the native pixel size of public/logo.png (see defaultLogoUrl).
const LOGO = { width: 150, height: 29 };

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Normalises user-entered URLs to http(s) so nothing like `javascript:` ends up in an href. */
export function toHttpUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^[a-z]+:\/*/i, '').replace(/^\/+/, '')}`;
}

function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function logo(data: SignatureData, size: { width: number; height: number }): string {
  return img(toHttpUrl(data.logoUrl || defaultLogoUrl()), COMPANY_NAME, size.width, size.height);
}

function subtitle(data: SignatureData): string {
  return [data.department.trim(), COMPANY_NAME].filter(Boolean).join(' · ');
}

interface ContactLine {
  label: string;
  text: string;
  href: string;
}

function contactLines(data: SignatureData): ContactLine[] {
  const lines: ContactLine[] = [];
  if (data.phone.trim()) lines.push({ label: 'T', text: data.phone.trim(), href: telHref(data.phone) });
  if (data.mobile.trim()) lines.push({ label: 'M', text: data.mobile.trim(), href: telHref(data.mobile) });
  if (data.email.trim()) lines.push({ label: 'E', text: data.email.trim(), href: `mailto:${data.email.trim()}` });
  if (data.website.trim()) lines.push({ label: 'W', text: displayUrl(data.website), href: toHttpUrl(data.website) });
  if (data.address.trim()) lines.push({ label: 'A', text: data.address.trim(), href: '' });
  return lines;
}

function link(text: string, href: string, color: string, extraStyle = ''): string {
  if (!href) return esc(text);
  return `<a href="${esc(href)}" style="color:${color};text-decoration:none;${extraStyle}">${esc(text)}</a>`;
}

function img(src: string, alt: string, width: number, height: number, extraStyle = ''): string {
  return (
    `<img src="${esc(src)}" alt="${esc(alt)}" width="${width}" height="${height}" ` +
    `style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;${extraStyle}" />`
  );
}

function photo(data: SignatureData, size: number): string {
  return img(toHttpUrl(data.photoUrl), data.fullName, size, size, 'border-radius:50%;object-fit:cover;');
}

function linkedinBadge(data: SignatureData, background: string, color: string): string {
  if (!data.linkedin.trim()) return '';
  return (
    `<a href="${esc(toHttpUrl(data.linkedin))}" title="LinkedIn" style="display:inline-block;width:22px;height:22px;` +
    `line-height:22px;text-align:center;background-color:${background};color:${color};border-radius:5px;` +
    `font-family:${FONT};font-size:12px;font-weight:bold;text-decoration:none;">in</a>`
  );
}

function contactTable(data: SignatureData, accent: string): string {
  const rows = contactLines(data)
    .map(
      (l) =>
        `<tr>` +
        `<td style="padding:2px 10px 2px 0;font-family:${FONT};font-size:11px;line-height:18px;font-weight:bold;color:${accent};vertical-align:top;">${l.label}</td>` +
        `<td style="padding:2px 0;font-family:${FONT};font-size:13px;line-height:18px;color:${BODY};">${link(l.text, l.href, BODY)}</td>` +
        `</tr>`
    )
    .join('');
  if (!rows) return '';
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${rows}</table>`;
}

const TABLE = 'cellpadding="0" cellspacing="0" border="0" role="presentation"';

// ─── Templates ────────────────────────────────────────────────────────────

function modernTemplate(data: SignatureData): string {
  const accent = data.accent;
  const hasPhoto = Boolean(data.photoUrl.trim());
  const contacts = contactTable(data, accent);
  const badge = linkedinBadge(data, accent, '#FFFFFF');
  const footer =
    data.showLogo || badge
      ? `<tr><td colspan="${hasPhoto ? 2 : 1}" style="padding-top:16px;">` +
        `<table ${TABLE} width="100%" style="border-collapse:collapse;border-top:1px solid ${BORDER};"><tr>` +
        `<td style="padding-top:10px;vertical-align:middle;">${data.showLogo ? logo(data, LOGO) : ''}</td>` +
        `<td align="right" style="padding:10px 0 0 12px;vertical-align:middle;">${badge}</td>` +
        `</tr></table></td></tr>`
      : '';

  return (
    `<table ${TABLE} style="border-collapse:collapse;font-family:${FONT};">` +
    `<tr>` +
    (hasPhoto ? `<td style="padding:0 18px 0 0;vertical-align:top;">${photo(data, 84)}</td>` : '') +
    `<td style="padding:0 0 0 16px;border-left:3px solid ${accent};vertical-align:top;">` +
    `<div style="margin:0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:bold;color:${TEXT};">${esc(data.fullName)}</div>` +
    (data.position.trim()
      ? `<div style="margin:2px 0 0;font-family:${FONT};font-size:13px;line-height:18px;font-weight:bold;color:${accent};">${esc(data.position)}</div>`
      : '') +
    `<div style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(subtitle(data))}</div>` +
    (contacts ? `<div style="margin:12px 0 0;">${contacts}</div>` : '') +
    `</td></tr>` +
    footer +
    `</table>`
  );
}

function minimalTemplate(data: SignatureData): string {
  const accent = data.accent;
  const inline = contactLines(data)
    .filter((l) => l.label !== 'A')
    .map(
      (l) =>
        `<span style="color:${accent};font-weight:bold;font-size:11px;">${l.label}</span>&nbsp;` +
        link(l.text, l.href, BODY)
    )
    .join(`<span style="color:${BORDER};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);
  const meta = [data.position.trim(), subtitle(data)].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  const hasPhoto = Boolean(data.photoUrl.trim());

  const body =
    `<table ${TABLE} style="border-collapse:collapse;font-family:${FONT};">` +
    `<tr><td style="font-family:${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${TEXT};">${esc(data.fullName)}</td></tr>` +
    `<tr><td style="font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${meta}</td></tr>` +
    `<tr><td style="padding:10px 0;"><table ${TABLE} style="border-collapse:collapse;"><tr>` +
    `<td width="32" height="2" bgcolor="${accent}" style="width:32px;height:2px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>` +
    `</tr></table></td></tr>` +
    (inline
      ? `<tr><td style="font-family:${FONT};font-size:12px;line-height:20px;color:${BODY};">${inline}</td></tr>`
      : '') +
    (data.address.trim()
      ? `<tr><td style="font-family:${FONT};font-size:12px;line-height:20px;color:${MUTED};">${esc(data.address.trim())}</td></tr>`
      : '') +
    (data.showLogo || data.linkedin.trim()
      ? `<tr><td style="padding-top:12px;"><table ${TABLE} style="border-collapse:collapse;"><tr>` +
        (data.showLogo
          ? `<td style="vertical-align:middle;padding-right:14px;">${logo(data, LOGO)}</td>`
          : '') +
        (data.linkedin.trim()
          ? `<td style="vertical-align:middle;">${linkedinBadge(data, '#F3F4F6', accent)}</td>`
          : '') +
        `</tr></table></td></tr>`
      : '') +
    `</table>`;

  if (!hasPhoto) return body;
  return (
    `<table ${TABLE} style="border-collapse:collapse;font-family:${FONT};"><tr>` +
    `<td style="padding:0 16px 0 0;vertical-align:top;">${photo(data, 64)}</td>` +
    `<td style="vertical-align:top;">${body}</td>` +
    `</tr></table>`
  );
}

function bannerTemplate(data: SignatureData): string {
  const accent = data.accent;
  const hasPhoto = Boolean(data.photoUrl.trim());
  const contacts = contactTable(data, accent);
  const website = data.website.trim()
    ? link(displayUrl(data.website), toHttpUrl(data.website), '#FFFFFF', 'font-weight:bold;')
    : '';
  const badge = data.linkedin.trim() ? linkedinBadge(data, '#FFFFFF', accent) : '';
  const barLeft = website || `<span style="font-family:${FONT};font-size:13px;font-weight:bold;color:#FFFFFF;">${COMPANY_NAME}</span>`;

  return (
    `<table ${TABLE} width="460" style="width:100%;max-width:460px;border-collapse:separate;border:1px solid ${BORDER};border-radius:12px;font-family:${FONT};">` +
    `<tr><td style="padding:18px 20px;">` +
    `<table ${TABLE} width="100%" style="border-collapse:collapse;"><tr>` +
    (hasPhoto ? `<td style="padding-right:14px;vertical-align:middle;">${photo(data, 60)}</td>` : '') +
    `<td style="vertical-align:middle;">` +
    `<div style="margin:0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:bold;color:${TEXT};">${esc(data.fullName)}</div>` +
    (data.position.trim()
      ? `<div style="margin:0;font-family:${FONT};font-size:13px;line-height:18px;color:${accent};font-weight:bold;">${esc(data.position)}</div>`
      : '') +
    `<div style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(subtitle(data))}</div>` +
    `</td>` +
    (data.showLogo ? `<td align="right" style="padding-left:12px;vertical-align:top;">${logo(data, LOGO)}</td>` : '') +
    `</tr></table>` +
    (contacts ? `<div style="margin:14px 0 0;">${contacts}</div>` : '') +
    `</td></tr>` +
    `<tr><td bgcolor="${accent}" style="background-color:${accent};padding:12px 20px;border-radius:0 0 11px 11px;">` +
    `<table ${TABLE} width="100%" style="border-collapse:collapse;"><tr>` +
    `<td style="vertical-align:middle;font-family:${FONT};font-size:12px;color:#FFFFFF;">${barLeft}</td>` +
    `<td align="right" style="padding-left:12px;vertical-align:middle;">${badge}</td>` +
    `</tr></table>` +
    `</td></tr>` +
    `</table>`
  );
}

function extras(data: SignatureData): string {
  const rows: string[] = [];
  if (data.showEco) {
    rows.push(
      `<tr><td style="padding-top:14px;font-family:${FONT};font-size:11px;line-height:16px;color:#2F7D4F;">&#127793;&nbsp;${esc(ECO_NOTE)}</td></tr>`
    );
  }
  if (data.showDisclaimer && data.disclaimer.trim()) {
    rows.push(
      `<tr><td style="padding-top:${data.showEco ? 6 : 14}px;font-family:${FONT};font-size:10px;line-height:14px;color:${FAINT};">${esc(data.disclaimer.trim())}</td></tr>`
    );
  }
  if (!rows.length) return '';
  return `<table ${TABLE} width="460" style="width:100%;max-width:460px;border-collapse:collapse;">${rows.join('')}</table>`;
}

const TEMPLATE_RENDERERS: Record<SignatureTemplate, (data: SignatureData) => string> = {
  modern: modernTemplate,
  minimal: minimalTemplate,
  banner: bannerTemplate,
};

// ─── Public API ───────────────────────────────────────────────────────────

/** Signature fragment ready to paste into a mail client. */
export function buildSignatureHtml(data: SignatureData): string {
  const render = TEMPLATE_RENDERERS[data.template] ?? modernTemplate;
  return `<div style="font-family:${FONT};color:${TEXT};">${render(data)}${extras(data)}</div>`;
}

/** Standalone document (e.g. for Outlook's %APPDATA%\Microsoft\Signatures folder). */
export function buildSignatureDocument(data: SignatureData): string {
  return (
    `<!DOCTYPE html>\n<html lang="pl">\n<head>\n<meta charset="utf-8" />\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
    `<title>Stopka e-mail – ${esc(data.fullName)}</title>\n</head>\n<body style="margin:0;padding:16px;background:#FFFFFF;">\n` +
    `${buildSignatureHtml(data)}\n</body>\n</html>\n`
  );
}

/** Plain-text fallback used for the text/plain clipboard flavour and plain-text emails. */
export function buildSignatureText(data: SignatureData): string {
  const lines = [
    data.fullName.trim(),
    [data.position.trim(), data.department.trim()].filter(Boolean).join(' | '),
    COMPANY_NAME,
  ].filter(Boolean);
  for (const l of contactLines(data)) lines.push(`${l.label}: ${l.text}`);
  if (data.linkedin.trim()) lines.push(`LinkedIn: ${toHttpUrl(data.linkedin)}`);
  if (data.showEco) lines.push('', ECO_NOTE);
  if (data.showDisclaimer && data.disclaimer.trim()) lines.push('', data.disclaimer.trim());
  return ['--', ...lines].join('\n');
}

export function signatureFileName(data: SignatureData): string {
  const slug = data.fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `stopka-nutri-partners${slug ? `-${slug}` : ''}.htm`;
}
