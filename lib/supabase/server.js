import { createServerClient } from '@supabase/ssr';

function serializeCookie(name, value, options = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  str += `; Path=${options.path || '/'}`;
  if (options.maxAge != null) str += `; Max-Age=${options.maxAge}`;
  if (options.domain) str += `; Domain=${options.domain}`;
  if (options.sameSite) str += `; SameSite=${options.sameSite}`;
  if (options.secure) str += '; Secure';
  if (options.httpOnly) str += '; HttpOnly';
  return str;
}

// Reads the Supabase session from a Pages Router API route's cookies. Middleware
// already validates/refreshes the session before any request reaches here, so this
// only needs to read the current user, not manage cookie refresh itself.
export async function getUserFromRequest(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          const existing = res.getHeader('Set-Cookie');
          const cookies = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.push(serializeCookie(name, value, options));
          });
          res.setHeader('Set-Cookie', cookies);
        }
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
