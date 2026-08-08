import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <NavLink to="/" className="navbar-brand" onClick={closeMenu}>BV</NavLink>

      {/* Desktop links */}
      <ul className="nav-links">
        <li><NavLink to="/"        end>Home</NavLink></li>
        <li><NavLink to="/about"      >About Me</NavLink></li>
        <li><NavLink to="/school"     >My School</NavLink></li>
        <li><NavLink to="/college"    >My College</NavLink></li>
      </ul>

      {/* Right controls */}
      <div className="nav-right">
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Hamburger */}
        <button
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <NavLink to="/"       end   onClick={closeMenu}>Home</NavLink>
        <NavLink to="/about"        onClick={closeMenu}>About Me</NavLink>
        <NavLink to="/school"       onClick={closeMenu}>My School</NavLink>
        <NavLink to="/college"      onClick={closeMenu}>My College</NavLink>
        <button className="theme-toggle-mobile" onClick={() => { toggle(); closeMenu(); }}>
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </nav>
  );
}

