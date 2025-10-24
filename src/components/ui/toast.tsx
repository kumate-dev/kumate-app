import { Toaster } from 'sonner';

export function Toast() {
  return <Toaster position="top-right" expand richColors closeButton duration={4000} />;
}
