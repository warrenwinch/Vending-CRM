// The two public Supabase settings. They come from .env.local on your
// computer and from Project Settings > Environment Variables on Vercel.
// The publishable (anon) key is safe in the browser: Row Level Security in
// the database decides what each logged-in user can see.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
