import { Redirect } from 'expo-router';

import { useStore } from '@/store';

/** Entry point: sends each person to the right place for their account state. */
export default function Index() {
  const s = useStore((st) => st.session);
  if (!s.signedIn) return <Redirect href="/welcome" />;
  if (!s.role) return <Redirect href="/role" />;
  if (s.role === 'worker') {
    if (!s.workerOnboarded) return <Redirect href="/onboarding/worker" />;
    if (s.workerKyc !== 'verified') return <Redirect href="/onboarding/review" />;
    return <Redirect href="/worker" />;
  }
  if (!s.businessOnboarded) return <Redirect href="/onboarding/business" />;
  if (s.businessKyc !== 'verified') return <Redirect href="/onboarding/review" />;
  return <Redirect href="/business" />;
}
