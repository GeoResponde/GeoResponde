import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/Navigation/TopNav';
import { Situation } from './pages/Situation';
import { Find } from './pages/Find';
import { Report } from './pages/Report';
import { About } from './pages/About';
import { ProviderStatus } from './pages/Dev/ProviderStatus';
import { Footer } from './components/layout/Footer';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
        <TopNav />
        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/situation" replace />} />
            <Route path="/situation" element={<Situation />} />
            <Route path="/find" element={<Find />} />
            <Route path="/report" element={<Report />} />
            <Route path="/about" element={<About />} />
            <Route path="/dev/providers" element={<ProviderStatus />} />
          </Routes>
          <Footer />
        </main>
      </div>
    </Router>
  );
}

export default App;
