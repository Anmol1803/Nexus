import { Toaster } from "@/components/ui/toaster"
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;