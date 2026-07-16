const navButtons = document.querySelectorAll('.navbtn');
const sections = document.querySelectorAll('.section');
const navToggle = document.getElementById('navToggle');
const sectionNav = document.querySelector('.sectionnav');
const themeToggle = document.getElementById('themeToggle');

const closeMenu = () => {
  sectionNav.classList.remove('open');
  navToggle.classList.remove('open');
};

navButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const targetId = btn.dataset.target;
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
      // else: no matching section on this page, let the browser follow
      // the href (e.g. "/#experience") to the homepage normally.
    }
    closeMenu();
  });
});

navToggle.addEventListener('click', () => {
  const isOpen = sectionNav.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
});

document.addEventListener('click', (e) => {
  if (
    sectionNav.classList.contains('open') &&
    !sectionNav.contains(e.target) &&
    !navToggle.contains(e.target)
  ) {
    closeMenu();
  }
});

const setActive = (id) => {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === id || btn.dataset.page === id);
  });
};

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setActive(entry.target.id);
      }
    });
  },
  { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
);

sections.forEach((section) => sectionObserver.observe(section));

// On pages that aren't the homepage (about, contact, blog), highlight the
// matching nav item by page slug instead of relying on scroll position.
const currentPage = document.body.dataset.page;
if (currentPage && currentPage !== 'home') {
  setActive(currentPage);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// contact form (contact.html only) — submits to Web3Forms, no backend required
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const statusEl = document.getElementById('formStatus');
  const submitBtn = contactForm.querySelector('.form-submit');

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(contactForm),
      });
      const result = await response.json();

      if (result.success) {
        statusEl.textContent = "Thanks, that's sent. I will get back to you soon.";
        statusEl.classList.add('success');
        contactForm.reset();
      } else {
        statusEl.textContent = 'Something went wrong sending that. Please email me directly instead.';
        statusEl.classList.add('error');
      }
    } catch (err) {
      statusEl.textContent = 'Something went wrong sending that. Please email me directly instead.';
      statusEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    }
  });
}
