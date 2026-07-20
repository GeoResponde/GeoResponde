import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/Navigation/TopNav';
import { Situation } from './pages/Situation';
import { Find } from './pages/Find';
import { Report } from './pages/Report';
import { Home } from './pages/Home';
import { ProviderStatus } from './pages/Dev/ProviderStatus';
import { Providers } from './pages/Providers';
import { Footer } from './components/layout/Footer';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw' }}>
        <TopNav />
        <main className="app-main" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/situation" element={<Situation />} />
            <Route path="/find" element={<Find />} />
            <Route path="/report" element={<Report />} />
            <Route path="/about" element={<Navigate to="/" replace />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/dev/providers" element={<ProviderStatus />} />
            <Route path="/dev/health" element={<Navigate to="/dev/providers" replace />} />
          </Routes>
          <Footer />
        </main>
      </div>
    </Router>
  );
}

export default App;
