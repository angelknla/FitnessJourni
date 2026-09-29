import { getSupabase } from '@/lib/supabase/server';

export interface MemberAccount {
  memberId: string;
  username: string;
  email: string;
}

export interface CredentialRow {
  member_id: string;
  username: string;
  email: string;
  password_hash: string;
}

const mapAccount = (row: CredentialRow): MemberAccount => ({
  memberId: row.member_id,
  username: row.username,
  email: row.email,
});

export const getAccount = async (memberId: string): Promise<MemberAccount | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('member_credentials')
    .select('member_id, username, email')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) {
    console.error('[accounts] profile read failed:', error.message);
    return null;
  }

  return data ? mapAccount(data as CredentialRow) : null;
};

export const getCredentialByMemberId = async (memberId: string): Promise<CredentialRow | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('member_credentials')
    .select('member_id, username, email, password_hash')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) {
    console.error('[accounts] credential read failed:', error.message);
    return null;
  }

  return (data as CredentialRow | null) ?? null;
};

export const getCredentialByLogin = async (login: string): Promise<CredentialRow | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const column = login.includes('@') ? 'email' : 'username';
  const { data, error } = await supabase
    .from('member_credentials')
    .select('member_id, username, email, password_hash')
    .eq(column, login)
    .maybeSingle();

  if (error) {
    console.error('[accounts] login read failed:', error.message);
    return null;
  }

  return (data as CredentialRow | null) ?? null;
};

export const createCredentials = async (
  memberId: string,
  username: string,
  email: string,
  passwordHash: string
): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return 'Supabase is not connected.';

  const { error } = await supabase.from('member_credentials').insert({
    member_id: memberId,
    username,
    email,
    password_hash: passwordHash,
  });

  if (!error) return null;
  if (error.code === '23505') return 'That username or email is already in use.';
  console.error('[accounts] credential create failed:', error.message);
  return 'Could not create those login details.';
};

export const updateCredentials = async (
  memberId: string,
  values: { email?: string; passwordHash?: string }
): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return 'Supabase is not connected.';

  const update: { email?: string; password_hash?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (values.email) update.email = values.email;
  if (values.passwordHash) update.password_hash = values.passwordHash;

  const { error } = await supabase
    .from('member_credentials')
    .update(update)
    .eq('member_id', memberId);

  if (!error) return null;
  if (error.code === '23505') return 'That email is already in use.';
  console.error('[accounts] credential update failed:', error.message);
  return 'Could not update your account.';
};

export const findAccountByUsername = async (username: string): Promise<MemberAccount | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('member_credentials')
    .select('member_id, username, email')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('[accounts] username lookup failed:', error.message);
    return null;
  }

  return data ? mapAccount(data as CredentialRow) : null;
};
