import { Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import { Toast } from '@/components/ui/toast';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
      <Toast />
    </>
  );
}
