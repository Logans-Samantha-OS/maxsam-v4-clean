// REPLACE: app/dashboard/not-found.tsx
import { redirect } from 'next/navigation';

export default function DashboardNotFound() {
  redirect('/dashboard');
}
