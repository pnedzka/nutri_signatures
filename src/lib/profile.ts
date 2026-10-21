// The signed-in person's profile from the Nutri Partners hub (My profile): name, job title, department, phones,
// LinkedIn and the address of their office. Read straight from Supabase as the user (row level security returns
// only their own row; offices are readable by everyone signed in). The login e-mail is the company e-mail.

import type { SignatureData } from './signature';
import { supabase } from './supabase';

interface ProfileRow {
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin_url: string | null;
  office: { address: string | null } | { address: string | null }[] | null;
}

/** Signature fields from the hub profile, only those that are filled in; null when it cannot be read. */
export async function profileFields(): Promise<Partial<SignatureData> | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getSession();
  const user = auth.session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, job_title, department, phone, mobile, linkedin_url, office:offices(address)')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();
  // Before the profile columns exist (or without a row) the generator simply starts empty.
  if (error || !data) return null;
  const office = Array.isArray(data.office) ? data.office[0] : data.office;
  const fields: Partial<SignatureData> = {
    fullName: data.full_name ?? '',
    position: data.job_title ?? '',
    department: data.department ?? '',
    phone: data.phone ?? '',
    mobile: data.mobile ?? '',
    email: (user.email ?? '').toLowerCase(),
    // Without a personal profile the icon keeps leading to the company page (the default).
    linkedin: data.linkedin_url ?? '',
    address: office?.address ?? '',
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => String(value).trim())) as Partial<SignatureData>;
}
