import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar      from './components/Navbar';
import Home        from './pages/Home';
import AboutPage   from './pages/AboutPage';
import SchoolPage  from './pages/SchoolPage';
import CollegePage from './pages/CollegePage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"        element={<Home />}        />
          <Route path="/about"   element={<AboutPage />}   />
          <Route path="/school"  element={<SchoolPage />}  />
          <Route path="/college" element={<CollegePage />} />
          {/* Any unknown path → home */}
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

