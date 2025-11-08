import { Toaster } from 'sonner';

export function Toast() {
  return <Toaster position="top-right" expand richColors closeButton theme="dark" duration={4000} />;
}
