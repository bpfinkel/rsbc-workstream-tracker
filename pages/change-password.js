import { useEffect } from 'react';
import { useRouter } from 'next/router';

// This route moved to /my-account. Kept as a redirect stub, not deleted, so any
// stale bookmark or link still lands somewhere useful instead of 404ing.
export default function ChangePasswordRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/my-account');
  }, [router]);
  return null;
}
