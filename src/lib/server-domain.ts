import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SupabaseEventRepository } from '@/domain/supabase-event-repository';
import { RegistrationDomain } from '@/domain/registration-domain';

export async function getServerRegistrationDomain(): Promise<RegistrationDomain> {
  const supabase = await createSupabaseServerClient();
  const repo = new SupabaseEventRepository(supabase);
  return new RegistrationDomain(repo);
}
