// Standalone Burger Menu for all pages
(function() {
  // Create the burger menu HTML
  function createBurgerMenu() {
    const container = document.createElement('div');
    container.className = 'burger-menu-container';
    container.innerHTML = `
      <button class="burger-menu-btn" aria-label="Menu">
        <span class="burger-line"></span>
        <span class="burger-line"></span>
        <span class="burger-line"></span>
      </button>
      <div class="burger-menu-dropdown" style="display: none;">
        <button class="burger-menu-item" data-href="/">
          <span class="burger-menu-icon">■</span>
          <span>App</span>
        </button>
        <button class="burger-menu-item" data-href="/preso2/index.html">
          <span class="burger-menu-icon">▶</span>
          <span>Presentation</span>
        </button>
        <button class="burger-menu-item" data-href="/slides/index.html">
          <span class="burger-menu-icon">◉</span>
          <span>Walkthrough</span>
        </button>
        <button class="burger-menu-item" data-href="/admin/index.html">
          <span class="burger-menu-icon">●</span>
          <span>Admin</span>
        </button>
      </div>
    `;

    // Add CSS if not already present
    if (!document.querySelector('#burger-menu-styles')) {
      const style = document.createElement('style');
      style.id = 'burger-menu-styles';
      style.textContent = `
        .burger-menu-container {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 1000;
        }

        .burger-menu-btn {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.3s ease;
          padding: 0;
        }

        .burger-menu-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.05);
        }

        .burger-line {
          width: 20px;
          height: 2px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .burger-menu-btn:hover .burger-line {
          background: #ffffff;
        }

        .burger-menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          min-width: 180px;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .burger-menu-item {
          width: 100%;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: #374151;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .burger-menu-item:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .burger-menu-item:not(:last-child) {
          border-bottom: 1px solid #e5e7eb;
        }

        .burger-menu-icon {
          font-size: 18px;
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          font-weight: bold;
        }
      `;
      document.head.appendChild(style);
    }

    return container;
  }

  // Initialize burger menu
  function initBurgerMenu() {
    const menu = createBurgerMenu();
    document.body.appendChild(menu);

    const btn = menu.querySelector('.burger-menu-btn');
    const dropdown = menu.querySelector('.burger-menu-dropdown');
    const items = menu.querySelectorAll('.burger-menu-item');

    let isOpen = false;

    // Toggle menu
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      dropdown.style.display = isOpen ? 'block' : 'none';
    });

    // Handle menu item clicks
    items.forEach(item => {
      item.addEventListener('click', () => {
        const href = item.getAttribute('data-href');
        if (href) {
          // Handle navigation based on current location
          const currentPath = window.location.pathname;
          let targetUrl = href;

          // Adjust paths based on current page depth
          if (currentPath.includes('/admin/') || currentPath.includes('/slides/') ||
              currentPath.includes('/preso2/') || currentPath.includes('/preso/')) {
            targetUrl = '..' + href;
          }

          window.location.href = targetUrl;
        }
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        isOpen = false;
        dropdown.style.display = 'none';
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBurgerMenu);
  } else {
    initBurgerMenu();
  }
})();