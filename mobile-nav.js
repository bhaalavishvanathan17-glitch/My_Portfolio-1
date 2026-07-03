/**
 * BHAALA PORTFOLIO - Mobile Navigation Drawer
 * Automatically generates a responsive hamburger menu for mobile devices
 * by cloning the existing desktop navigation links.
 */

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Prevent duplicate injection if script is loaded twice
    if (document.querySelector('.mobile-menu-btn')) return;

    // 1. Create Hamburger Button
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'mobile-menu-btn';
    hamburgerBtn.setAttribute('aria-label', 'Toggle navigation menu');
    hamburgerBtn.innerHTML = `
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
    `;
    navbar.appendChild(hamburgerBtn);

    // 2. Create Overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);

    // 3. Create Drawer
    const drawer = document.createElement('div');
    drawer.className = 'mobile-drawer';

    // 4. Clone Desktop Navigation Links
    const desktopNavUl = navbar.querySelector('ul');
    if (desktopNavUl) {
        const mobileNavUl = desktopNavUl.cloneNode(true);
        drawer.appendChild(mobileNavUl);
    }
    document.body.appendChild(drawer);

    // Toggle State & Logic
    let isOpen = false;

    const toggleMenu = () => {
        isOpen = !isOpen;
        
        // Toggle CSS classes
        hamburgerBtn.classList.toggle('active', isOpen);
        drawer.classList.toggle('active', isOpen);
        overlay.classList.toggle('active', isOpen);
        
        // Prevent background scrolling
        document.body.style.overflow = isOpen ? 'hidden' : '';

        // Accessibility: Focus management
        if (isOpen) {
            const firstLink = drawer.querySelector('a');
            if (firstLink) {
                // Short delay to allow display transition before focus
                setTimeout(() => firstLink.focus(), 100);
            }
        } else {
            hamburgerBtn.focus();
        }
    };

    // Event Listeners
    hamburgerBtn.addEventListener('click', toggleMenu);
    
    overlay.addEventListener('click', () => {
        if (isOpen) toggleMenu();
    });

    // Close when a link inside the drawer is clicked
    drawer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (isOpen) toggleMenu();
        });
    });

    // Accessibility: Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            toggleMenu();
        }
    });
});
