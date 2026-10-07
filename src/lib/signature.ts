// Email signature generator.
// Output must survive Gmail, Outlook (incl. classic desktop/Word engine) and Apple Mail,
// so everything is table-based with inline styles, web-safe fonts and PNG images only (no SVG).
// Texts that end up in the signature are English (Nutri Partners is an international company); the generator UI is Polish.

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
  instagram: string;
  facebook: string;
  address: string;
  photoUrl: string;
  template: SignatureTemplate;
  accent: string;
  showLogo: boolean;
  showDisclaimer: boolean;
  disclaimer: string;
  showEco: boolean;
  showIcons: boolean;
  showCerts: boolean;
  logoUrl: string;
}

export const COMPANY_NAME = 'Nutri Partners';

export const DEFAULT_WEBSITE = 'nutripartners.co';

/** The logo links here. */
export const COMPANY_URL = 'https://nutripartners.co';

/** Company profiles used as defaults for the social media icons (from nutripartners.co). Empty = icon hidden. */
export const COMPANY_SOCIAL = {
  linkedin: 'https://www.linkedin.com/company/106882083',
  instagram: 'https://www.instagram.com/nutripartners.co/',
  facebook: '',
};

export const DEFAULT_DISCLAIMER =
  'This message and any attachments may contain confidential information intended solely for the addressee. ' +
  'If you are not the intended recipient, please notify the sender immediately and delete this message. ' +
  'Any disclosure, copying or use of its contents is prohibited.';

/**
 * Company certificates shown as small badges ("pills") in the signature footer.
 * href: optional link, e.g. to the certificate PDF on nutripartners.co. color: null = accent colour.
 */
export const CERTIFICATES: { label: string; icon: string; color: string | null; href?: string }[] = [
  {
    label: 'ISO 9001',
    icon: 'quality',
    color: null,
    href: 'https://nutripartners.co/wp-content/uploads/2026/01/ISO-CERT.pdf',
  },
  {
    label: 'Organic Certified',
    icon: 'leaf',
    color: '#2F7D4F',
    href: 'https://nutripartners.co/wp-content/uploads/2026/01/eko-CERT.pdf',
  },
];

export const ECO_NOTE = 'Please consider the environment before printing this email.';

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
 * Logo at 2× its display size (public/logo.png, 300×58 px shown as 150×29) so it stays sharp on Retina screens.
 * The file is tagged 192 DPI: Outlook desktop sizes images by DPI when it drops width/height on replies and
 * forwards, so it still lands at 150×29 there. Keep any replacement at 2× and 192 DPI.
 * Override with VITE_EMAIL_LOGO_URL to load the same file from another public host.
 */
export function defaultLogoUrl(): string {
  const fromEnv = import.meta.env.VITE_EMAIL_LOGO_URL as string | undefined;
  if (fromEnv) return fromEnv;
  return `${assetsBaseUrl()}/logo.png`;
}

/** Public host of the images in /public (logo, contact icons). Defaults to wherever the generator runs. */
function assetsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_EMAIL_ASSETS_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function isLocalUrl(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(url.trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────
//
// Size budget: Gmail rejects signatures over 10,000 characters of HTML (Outlook.com has the same limit, older
// Exchange/OWA about 8,000), so markup is kept lean: no role/rel attributes, no CSS that only repeats an HTML
// attribute, spacing via table cells (Outlook desktop ignores margin on most elements) and short style strings.
// Outlook desktop does not inherit font-family into tables, so every text cell sets it again.

const FONT = 'Arial,Helvetica,sans-serif';
const TEXT = '#111827';
const BODY = '#374151';
const MUTED = '#6B7280'; // 4.8:1 on white, the lightest grey used for text (WCAG AA)
const BORDER = '#E5E7EB';

// Display size; public/logo.png is exactly twice this (see defaultLogoUrl).
const LOGO = { width: 150, height: 29 };

/** cellpadding/cellspacing="0" also replace border-collapse:collapse. */
const TABLE = 'cellpadding="0" cellspacing="0" border="0"';

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

/** Text cell: font settings repeated per cell for Outlook desktop. */
function textStyle(size: number, lineHeight: number, color: string, extra = ''): string {
  return `font-family:${FONT};font-size:${size}px;line-height:${lineHeight}px;color:${color};${extra}`;
}

function img(src: string, alt: string, width: number, height: number, extraStyle = ''): string {
  // max-width:none: some apps force img{max-width:100%}, which would squeeze the logo/photo in narrow cells.
  return `<img src="${esc(src)}" alt="${esc(alt)}" width="${width}" height="${height}" style="display:block;max-width:none;border:0;${extraStyle}">`;
}

/** White glyph from /public/icons (24×24 file shown at 12×12); alt text (white, small) shows instead when images are blocked. */
function iconImg(name: string, alt: string, layout = 'vertical-align:middle;'): string {
  return (
    `<img src="${esc(`${assetsBaseUrl()}/icons/${name}.png`)}" alt="${alt}" width="${ICON}" height="${ICON}" ` +
    `style="border:0;${layout}color:#FFFFFF;font-size:9px;">`
  );
}

/** Fixed-size coloured circle (square in classic Outlook, which has no border-radius). */
function circle(size: number, color: string, content: string): string {
  return (
    `<table ${TABLE}><tr><td width="${size}" height="${size}" align="center" bgcolor="${color}" ` +
    `style="border-radius:50%;line-height:0;">${content}</td></tr></table>`
  );
}

function logo(data: SignatureData, size: { width: number; height: number }): string {
  return `<a href="${COMPANY_URL}" target="_blank">${img(toHttpUrl(data.logoUrl || defaultLogoUrl()), COMPANY_NAME, size.width, size.height)}</a>`;
}

function subtitle(data: SignatureData): string {
  return [data.department.trim(), COMPANY_NAME].filter(Boolean).join(' · ');
}

type ContactIcon = 'phone' | 'mobile' | 'email' | 'web' | 'address';

interface ContactLine {
  label: string;
  icon: ContactIcon;
  text: string;
  href: string;
}

function contactLines(data: SignatureData): ContactLine[] {
  const lines: ContactLine[] = [];
  if (data.phone.trim()) lines.push({ label: 'T', icon: 'phone', text: data.phone.trim(), href: telHref(data.phone) });
  if (data.mobile.trim()) lines.push({ label: 'M', icon: 'mobile', text: data.mobile.trim(), href: telHref(data.mobile) });
  if (data.email.trim())
    lines.push({ label: 'E', icon: 'email', text: data.email.trim(), href: `mailto:${data.email.trim()}` });
  if (data.website.trim())
    lines.push({ label: 'W', icon: 'web', text: displayUrl(data.website), href: toHttpUrl(data.website) });
  if (data.address.trim())
    lines.push({ label: 'A', icon: 'address', text: data.address.trim(), href: googleMapsUrl(data.address.trim()) });
  return lines;
}

/** Keeps Polish postcodes (e.g. 35-021) on one line; otherwise narrow screens break them at the hyphen. */
function keepPostcode(escaped: string): string {
  return escaped.replace(/\b(\d{2}-\d{3})\b/g, '<span style="white-space:nowrap;">$1</span>');
}

/** Web links open in a new tab/window (mail clients add their own rel=noopener); mailto: and tel: are left alone. */
function anchorAttrs(href: string): string {
  return `href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank"' : ''}`;
}

function link(text: string, href: string, color: string, extraStyle = ''): string {
  const label = keepPostcode(esc(text));
  if (!href) return label;
  return `<a ${anchorAttrs(href)} style="color:${color};text-decoration:none;${extraStyle}">${label}</a>`;
}

// Google Maps works on every device: the app on Android/iOS when installed, the browser otherwise.
function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function photo(data: SignatureData, size: number): string {
  // Explicit CSS size + object-fit keep non-square photos round and undistorted.
  return img(toHttpUrl(data.photoUrl), data.fullName, size, size, `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;`);
}

/** Photo column that table layout cannot squeeze on narrow screens (the text column wraps instead). */
function photoCell(data: SignatureData, size: number, gap: number, valign: 'top' | 'middle' = 'top'): string {
  const w = size + gap;
  return `<td width="${w}" valign="${valign}" style="min-width:${w}px;padding-right:${gap}px;">${photo(data, size)}</td>`;
}

/**
 * Floated block (table align=left/right): sits side by side when there is room and wraps onto the next line on
 * narrow phone screens. Works in Outlook desktop too, unlike inline-block.
 */
function floatBlock(align: 'left' | 'right', content: string, padding: string): string {
  return `<table ${TABLE} align="${align}"><tr><td style="padding:${padding};">${content}</td></tr></table>`;
}

/** One table row per block: the Outlook-safe way to stack content with vertical spacing. */
function rows(items: (string | false | null | undefined)[]): string {
  return items.filter(Boolean).map((r) => `<tr>${r}</tr>`).join('');
}

const SOCIAL_HEADING = 'Follow us';

const SOCIAL_NETWORKS = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
] as const;

/** Row of linked social icons (same white glyph in an accent circle as the contact icons). */
function socialRow(data: SignatureData, accent: string): string {
  const items = SOCIAL_NETWORKS.filter((n) => data[n.key].trim());
  if (!items.length) return '';
  const cells = items
    .map(
      (n) =>
        `<td style="padding-left:8px;">` +
        circle(ICON_BADGE, accent, `<a ${anchorAttrs(toHttpUrl(data[n.key]))} title="${n.label}">${iconImg(n.key, n.label.slice(0, 2))}</a>`) +
        `</td>`
    )
    .join('');
  // Company profiles, set apart from the employee's own contact details by a hairline and a small heading.
  return (
    `<table ${TABLE} width="100%"><tr><td style="border-top:1px solid ${BORDER};padding-top:10px;">` +
    `<table ${TABLE}><tr>` +
    `<td style="${textStyle(10, 14, MUTED, 'padding-right:4px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;')}">${SOCIAL_HEADING}</td>` +
    cells +
    `</tr></table></td></tr></table>`
  );
}

/** Darkens a #RRGGBB colour; used for badge circles that sit on an accent-coloured background. */
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Certificate pills; onColor = drawn on the accent bar (Baner), with a white outline and text. */
function certBadges(data: SignatureData, onColor = false): string {
  if (!data.showCerts || CERTIFICATES.length === 0) return '';
  const cells = CERTIFICATES.map((c, i) => {
    const fill = c.color ?? (onColor ? darken(data.accent, 0.3) : data.accent);
    const text = onColor ? '#FFFFFF' : BODY;
    const pill =
      `<table ${TABLE} style="border-collapse:separate;border:1px solid ${onColor ? '#FFFFFF' : BORDER};border-radius:999px;"${onColor ? '' : ' bgcolor="#FFFFFF"'}><tr>` +
      `<td style="padding:3px 0 3px 3px;">${circle(18, fill, iconImg(c.icon, ''))}</td>` +
      `<td style="${textStyle(11, 14, text, 'padding:3px 10px 3px 6px;font-weight:bold;white-space:nowrap;')}">${esc(c.label)}</td>` +
      `</tr></table>`;
    const content = c.href ? `<a ${anchorAttrs(toHttpUrl(c.href))} style="text-decoration:none;">${pill}</a>` : pill;
    return `<td${i ? ' style="padding-left:6px;"' : ''}>${content}</td>`;
  }).join('');
  return `<table ${TABLE}><tr>${cells}</tr></table>`;
}

// White glyph (2× file shown at 12×12 px, 192 DPI like the logo) on a circle in the accent colour, so one icon set
// fits every accent. If images are blocked, the alt text shows the letter inside the circle instead.
const ICON = 12;
const ICON_BADGE = 20;

function contactMarker(data: SignatureData, l: ContactLine, accent: string): string {
  if (data.showIcons) return circle(ICON_BADGE, accent, iconImg(l.icon, l.label));
  return `<span style="${textStyle(11, 18, accent, 'font-weight:bold;')}">${l.label}</span>`;
}

function contactTable(data: SignatureData, accent: string): string {
  const lines = contactLines(data);
  if (!lines.length) return '';
  const markerWidth = (data.showIcons ? ICON_BADGE : 12) + 10;
  return (
    `<table ${TABLE}>` +
    lines
      .map(
        (l) =>
          `<tr><td width="${markerWidth}" style="padding:2px 0;">${contactMarker(data, l, accent)}</td>` +
          `<td style="${textStyle(13, 18, BODY, 'padding:2px 0;')}">${link(l.text, l.href, BODY)}</td></tr>`
      )
      .join('') +
    `</table>`
  );
}

/** Name, position and "department · company" lines shared by the Nowoczesna and Baner templates. */
function identityRows(data: SignatureData, accent: string): string[] {
  return [
    `<td style="${textStyle(18, 24, TEXT, 'font-weight:bold;')}">${esc(data.fullName)}</td>`,
    data.position.trim() ? `<td style="${textStyle(13, 18, accent, 'font-weight:bold;')}">${esc(data.position)}</td>` : '',
    `<td style="${textStyle(12, 18, MUTED)}">${esc(subtitle(data))}</td>`,
  ];
}

// ─── Templates ────────────────────────────────────────────────────────────

function modernTemplate(data: SignatureData): string {
  const accent = data.accent;
  const hasPhoto = Boolean(data.photoUrl.trim());
  const contacts = contactTable(data, accent);
  const social = socialRow(data, accent);
  const certs = certBadges(data);
  const footer =
    data.showLogo || certs
      ? `<tr><td colspan="${hasPhoto ? 2 : 1}" style="padding-top:16px;">` +
        `<table ${TABLE} width="100%"><tr><td style="border-top:1px solid ${BORDER};">` +
        (data.showLogo ? floatBlock('left', logo(data, LOGO), '10px 14px 0 0') : '') +
        (certs ? floatBlock('left', certs, '10px 0 0 0') : '') +
        `</td></tr></table></td></tr>`
      : '';

  return (
    `<table ${TABLE}><tr>` +
    (hasPhoto ? photoCell(data, 84, 18) : '') +
    `<td valign="top" style="padding-left:16px;border-left:3px solid ${accent};">` +
    `<table ${TABLE}>` +
    rows([
      ...identityRows(data, accent),
      contacts && `<td style="padding-top:12px;">${contacts}</td>`,
      social && `<td style="padding-top:14px;">${social}</td>`,
    ]) +
    `</table></td></tr>` +
    footer +
    `</table>`
  );
}

function minimalTemplate(data: SignatureData): string {
  const accent = data.accent;
  const inline = contactLines(data)
    .filter((l) => l.label !== 'A')
    .map((l) =>
      `<span style="white-space:nowrap;">` +
      (data.showIcons
        ? // Inline badge: a table would force a line break, so the circle is a span (square in classic Outlook).
          `<span style="display:inline-block;width:18px;height:18px;background-color:${accent};border-radius:50%;vertical-align:middle;">` +
          iconImg(l.icon, l.label, 'display:block;margin:3px;') +
          `</span>&nbsp;` +
          link(l.text, l.href, BODY, 'vertical-align:middle;')
        : `<span style="color:${accent};font-weight:bold;font-size:11px;">${l.label}</span>&nbsp;` + link(l.text, l.href, BODY)) +
      `</span>`
    )
    // Plain spaces around the separator are the only line-break points, so an icon never ends up alone on a line.
    .join(` <span style="color:${BORDER};">&nbsp;|&nbsp;</span> `);
  const address = contactLines(data).find((l) => l.label === 'A');
  const meta = [data.position.trim(), subtitle(data)].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  const social = socialRow(data, accent);
  const hasPhoto = Boolean(data.photoUrl.trim());

  const body =
    `<table ${TABLE}>` +
    rows([
      `<td style="${textStyle(16, 22, TEXT, 'font-weight:bold;')}">${esc(data.fullName)}</td>`,
      `<td style="${textStyle(12, 18, MUTED)}">${meta}</td>`,
      `<td style="padding:10px 0;"><table ${TABLE}><tr><td width="32" height="2" bgcolor="${accent}" style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`,
      inline && `<td style="${textStyle(12, 20, BODY)}">${inline}</td>`,
      address && `<td style="${textStyle(12, 20, MUTED)}">${link(address.text, address.href, MUTED)}</td>`,
      social && `<td style="padding-top:12px;">${social}</td>`,
      (data.showLogo || data.showCerts) &&
        `<td style="padding-top:2px;">` +
          (data.showLogo ? floatBlock('left', logo(data, LOGO), '10px 14px 0 0') : '') +
          (data.showCerts ? floatBlock('left', certBadges(data), '10px 0 0 0') : '') +
          `</td>`,
    ]) +
    `</table>`;

  if (!hasPhoto) return body;
  return `<table ${TABLE}><tr>${photoCell(data, 64, 16)}<td valign="top">${body}</td></tr></table>`;
}

function bannerTemplate(data: SignatureData): string {
  const accent = data.accent;
  const hasPhoto = Boolean(data.photoUrl.trim());
  const contacts = contactTable(data, accent);
  const website = data.website.trim()
    ? link(displayUrl(data.website), toHttpUrl(data.website), '#FFFFFF', 'font-weight:bold;')
    : `<span style="font-weight:bold;">${COMPANY_NAME}</span>`;
  const social = socialRow(data, accent);

  return (
    `<table ${TABLE} width="460" style="width:100%;max-width:460px;border-collapse:separate;border:1px solid ${BORDER};border-radius:12px;">` +
    `<tr><td style="padding:18px 20px;">` +
    (data.showLogo ? floatBlock('right', logo(data, LOGO), '0 0 10px 12px') : '') +
    `<table ${TABLE}><tr>` +
    (hasPhoto ? photoCell(data, 60, 14, 'middle') : '') +
    `<td><table ${TABLE}>${rows(identityRows(data, accent))}</table></td>` +
    `</tr></table>` +
    (contacts || social
      ? `<table ${TABLE}>` +
        rows([
          contacts && `<td style="padding-top:14px;">${contacts}</td>`,
          social && `<td style="padding-top:14px;">${social}</td>`,
        ]) +
        `</table>`
      : '') +
    `</td></tr>` +
    `<tr><td bgcolor="${accent}" style="padding:12px 20px;border-radius:0 0 11px 11px;">` +
    floatBlock('left', `<span style="${textStyle(12, 28, '#FFFFFF')}">${website}</span>`, '2px 12px 2px 0') +
    (data.showCerts ? floatBlock('right', certBadges(data, true), '2px 0') : '') +
    `</td></tr>` +
    `</table>`
  );
}

function extras(data: SignatureData): string {
  const items: string[] = [];
  if (data.showEco) {
    items.push(`<td style="${textStyle(11, 16, '#2F7D4F', 'padding-top:14px;')}">&#127793;&nbsp;${esc(ECO_NOTE)}</td>`);
  }
  if (data.showDisclaimer && data.disclaimer.trim()) {
    items.push(
      `<td style="${textStyle(11, 15, MUTED, `padding-top:${data.showEco ? 6 : 14}px;`)}">${esc(data.disclaimer.trim())}</td>`
    );
  }
  if (!items.length) return '';
  return `<table ${TABLE} width="460" style="width:100%;max-width:460px;">${rows(items)}</table>`;
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
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
    `<title>Email signature – ${esc(data.fullName)}</title>\n</head>\n<body style="margin:0;padding:16px;background:#FFFFFF;">\n` +
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
  for (const n of SOCIAL_NETWORKS) if (data[n.key].trim()) lines.push(`${n.label}: ${toHttpUrl(data[n.key])}`);
  if (data.showCerts && CERTIFICATES.length) lines.push(`Certificates: ${CERTIFICATES.map((c) => c.label).join(', ')}`);
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
  return `email-signature-nutri-partners${slug ? `-${slug}` : ''}.htm`;
}
