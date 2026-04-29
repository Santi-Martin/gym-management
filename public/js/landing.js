// Landing Page JS
(function () {
  'use strict';

  // Navbar scroll effect
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile menu
  const burger = document.getElementById('nav-burger');
  const navLinks = document.getElementById('nav-links');

  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    navLinks.classList.toggle('open');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('open');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Scroll reveal
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 100);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  // Section header reveal
  const sectionHeaders = document.querySelectorAll('.section-header');
  const headerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease both';
        entry.target.style.opacity = '1';
        headerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  sectionHeaders.forEach(h => {
    h.style.opacity = '0';
    headerObserver.observe(h);
  });

  // Active nav link highlight on scroll
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav__link:not(.nav__link--cta)');

  const activeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navAnchors.forEach(a => a.classList.remove('active'));
        const active = document.querySelector(`.nav__link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.5 });

  sections.forEach(s => activeObserver.observe(s));

  // Redirect to app if already logged in
  const token = localStorage.getItem('accessToken');
  if (token) {
    const loginLinks = document.querySelectorAll('a[href="/app"]');
    loginLinks.forEach(l => {
      l.textContent = l.id === 'hero-cta-login' ? 'Ir al panel' :
                      l.id === 'nav-access' ? 'Mi panel' : l.textContent;
    });
  }

  // ─── Estado abierto / cerrado (hora Argentina) ───────────────────────
  function isGymOpen() {
    // Hora actual en Argentina (UTC-3, sin DST)
    const now = new Date();
    const argStr = now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
    const arg = new Date(argStr);

    const day  = arg.getDay();   // 0=Dom, 1=Lun … 6=Sáb
    const hour = arg.getHours();
    const min  = arg.getMinutes();
    const time = hour * 60 + min; // minutos desde medianoche

    // Lun–Vie (1–5): 07:00 – 00:00 (medianoche = 1440 min)
    if (day >= 1 && day <= 5) {
      return time >= 7 * 60 && time < 24 * 60;
    }
    // Sábado (6): 09:00 – 21:00
    if (day === 6) {
      return time >= 9 * 60 && time < 21 * 60;
    }
    // Domingo (0): 16:00 – 20:00
    if (day === 0) {
      return time >= 16 * 60 && time < 20 * 60;
    }
    return false;
  }

  function updateScheduleStatus() {
    const badge = document.getElementById('schedule-status');
    if (!badge) return;
    const open = isGymOpen();
    badge.textContent = open ? 'Abierto ahora' : 'Cerrado';
    badge.className = 'schedule__status ' + (open ? 'schedule__status--open' : 'schedule__status--closed');
  }

  updateScheduleStatus();
  setInterval(updateScheduleStatus, 60 * 1000); // actualiza cada minuto

})();
