const navToggle = document.getElementById("nav-toggle");
const header = document.querySelector(".site-header");
const navLinks = document.querySelectorAll(".nav-links a");
const searchForm = document.querySelector(".nav-search");
const searchInput = document.querySelector(".nav-search input");
const cartButton = document.querySelector(".cart-button");
const cartCount = document.querySelector(".cart-button strong");
const slides = Array.from(document.querySelectorAll(".hero-slide"));
const dots = Array.from(document.querySelectorAll(".hero-dots button"));
const previousButton = document.querySelector(".hero-arrow.prev");
const nextButton = document.querySelector(".hero-arrow.next");
const contactSection = document.querySelector(".contact-section");
const contactCards = Array.from(document.querySelectorAll(".contact-card"));
const socialLinks = Array.from(document.querySelectorAll(".footer-socials a"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const autoScrollSections = Array.from(document.querySelectorAll("#home, #products, #contact"));

let cartItems = Number(cartCount?.textContent || 0);
let currentSlide = slides.findIndex((slide) => slide.classList.contains("active"));
let slideTimer;
let autoScrollTimer;
let autoScrollPausedUntil = 0;

if (currentSlide < 0) {
  currentSlide = 0;
}

function closeMobileMenu() {
  if (navToggle) {
    navToggle.checked = false;
  }
}

function setActiveLink(clickedLink) {
  navLinks.forEach((link) => link.classList.remove("active"));
  clickedLink.classList.add("active");
}

function showToast(message) {
  const oldToast = document.querySelector(".nav-toast");

  if (oldToast) {
    oldToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = "nav-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);

  setTimeout(() => {
    toast.remove();
  }, 2200);
}

function showSlide(index) {
  if (!slides.length) {
    return;
  }

  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === currentSlide);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === currentSlide);
  });
}

function startSlideTimer() {
  window.clearInterval(slideTimer);

  if (slides.length > 1) {
    slideTimer = window.setInterval(() => {
      showSlide(currentSlide + 1);
    }, 5500);
  }
}

function moveSlide(direction) {
  showSlide(currentSlide + direction);
  startSlideTimer();
}

function createPageLoader() {
  const loader = document.createElement("div");
  loader.className = "page-loader";
  loader.innerHTML = `
    <div class="loader-card" role="status" aria-live="polite">
      <span class="loader-logo">M&amp;M</span>
      <strong>Loading M&amp;M Enterprises</strong>
      <small>Preparing the collection</small>
      <span class="loader-line"></span>
    </div>
  `;
  document.body.prepend(loader);

  const hideLoader = () => {
    loader.classList.add("loaded");

    window.setTimeout(() => {
      loader.remove();
      document.body.classList.add("site-ready");
    }, reducedMotion ? 80 : 650);
  };

  if (document.readyState === "complete") {
    window.setTimeout(hideLoader, 450);
  } else {
    window.addEventListener("load", () => {
      window.setTimeout(hideLoader, 650);
    });
  }
}

function createScrollProgress() {
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.appendChild(progress);

  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progress.style.width = `${Math.min(percent, 100)}%`;
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
}

function setupScrollReveal() {
  const revealItems = document.querySelectorAll(
    ".hero-content, .products-heading, .product-feature, .contact-card, .footer-brand, .social-heading, .footer-socials, .footer-bottom"
  );

  revealItems.forEach((item) => item.classList.add("js-reveal"));

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("in-view"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -60px 0px" }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

function setupMagneticButtons() {
  const magneticItems = document.querySelectorAll(
    ".nav-search button, .cart-button, .icon-button, .hero-content a, .product-footer a, .footer-socials a, .footer-bottom a"
  );

  if (reducedMotion) {
    return;
  }

  magneticItems.forEach((item) => {
    item.addEventListener("pointermove", (event) => {
      const bounds = item.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;

      item.style.setProperty("--magnet-x", `${x * 0.16}px`);
      item.style.setProperty("--magnet-y", `${y * 0.16}px`);
      item.style.transform = `translate3d(${x * 0.16}px, ${y * 0.16}px, 0) scale(1.02)`;
      item.classList.add("magnetic-hover");
    });

    item.addEventListener("pointerleave", () => {
      item.classList.remove("magnetic-hover");
      item.style.removeProperty("--magnet-x");
      item.style.removeProperty("--magnet-y");
      item.style.removeProperty("transform");
    });
  });
}

function setupTiltCards() {
  const tiltCards = document.querySelectorAll(".product-feature, .contact-card");

  if (reducedMotion) {
    return;
  }

  tiltCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;

      card.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 5).toFixed(2)}deg`);
      card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-8px)`;
      card.classList.add("tilt-active");
    });

    card.addEventListener("pointerleave", () => {
      card.classList.remove("tilt-active");
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
      card.style.removeProperty("transform");
    });
  });
}

function setupRippleEffects() {
  const rippleTargets = document.querySelectorAll("button, .hero-content a, .product-footer a, .contact-card, .footer-socials a, .footer-bottom a");

  rippleTargets.forEach((target) => {
    target.addEventListener("click", (event) => {
      const bounds = target.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(bounds.width, bounds.height);

      ripple.className = "click-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - bounds.left - size / 2}px`;
      ripple.style.top = `${event.clientY - bounds.top - size / 2}px`;

      target.appendChild(ripple);

      window.setTimeout(() => {
        ripple.remove();
      }, 620);
    });
  });
}

function updateActiveNavOnScroll() {
  const sections = Array.from(document.querySelectorAll("#home, #products, #contact"));
  const currentSection = sections
    .filter((section) => section.getBoundingClientRect().top <= 180)
    .pop();

  if (!currentSection) {
    return;
  }

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === `#${currentSection.id}`);
  });
}

function setupScrollEffects() {
  const parallaxItems = [
    { element: document.querySelector(".hero-content"), speed: -0.16 },
    { element: document.querySelector(".products-heading"), speed: -0.08 },
    { element: document.querySelector(".product-showcase"), speed: -0.05 },
    { element: document.querySelector(".footer-inner"), speed: -0.07 }
  ].filter((item) => item.element);

  const scrollCards = Array.from(document.querySelectorAll(".product-feature, .contact-card"));

  if (reducedMotion) {
    return;
  }

  const updateScrollEffects = () => {
    const viewportHeight = window.innerHeight || 1;
    const scrollY = window.scrollY;

    document.documentElement.style.setProperty("--scroll-y", `${scrollY}px`);

    parallaxItems.forEach(({ element, speed }) => {
      const rect = element.getBoundingClientRect();
      const centerOffset = rect.top + rect.height / 2 - viewportHeight / 2;
      const movement = Math.max(Math.min(centerOffset * speed, 42), -42);

      element.style.setProperty("--scroll-shift", `${movement.toFixed(2)}px`);
    });

    scrollCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const progress = 1 - Math.min(Math.max(rect.top / viewportHeight, 0), 1);
      const side = index % 2 === 0 ? -1 : 1;
      const slide = (1 - progress) * 34 * side;
      const fade = Math.min(Math.max(progress * 1.25, 0), 1);

      card.style.setProperty("--scroll-slide", `${slide.toFixed(2)}px`);
      card.style.setProperty("--scroll-fade", fade.toFixed(2));
    });
  };

  let ticking = false;
  const requestScrollUpdate = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    requestAnimationFrame(() => {
      updateScrollEffects();
      ticking = false;
    });
  };

  updateScrollEffects();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
}

function pauseAutoScroll(duration = 9000) {
  autoScrollPausedUntil = Date.now() + duration;
}

function getCurrentAutoScrollIndex() {
  const headerOffset = header ? header.offsetHeight + 24 : 96;
  const currentSection = autoScrollSections
    .filter((section) => section.getBoundingClientRect().top <= headerOffset)
    .pop();

  return Math.max(autoScrollSections.indexOf(currentSection), 0);
}

function setupAutoPageScroll() {
  if (reducedMotion || autoScrollSections.length < 2) {
    return;
  }

  const interactionEvents = ["wheel", "touchstart", "pointerdown", "keydown"];

  interactionEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => pauseAutoScroll(), { passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAutoScroll(15000);
    }
  });

  autoScrollTimer = window.setInterval(() => {
    if (document.hidden || Date.now() < autoScrollPausedUntil) {
      return;
    }

    const nextIndex = (getCurrentAutoScrollIndex() + 1) % autoScrollSections.length;

    autoScrollSections[nextIndex].scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 8000);
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    pauseAutoScroll(12000);
    setActiveLink(link);
    closeMobileMenu();
  });
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const value = searchInput?.value.trim() || "";

  if (!value) {
    showToast("Type a product name to search");
    searchInput?.focus();
    return;
  }

  showToast(`Searching for "${value}"`);
  closeMobileMenu();
});

cartButton?.addEventListener("click", (event) => {
  event.preventDefault();

  cartItems += 1;
  if (cartCount) {
    cartCount.textContent = cartItems;
  }
  cartButton.classList.add("cart-pop");
  showToast("Item added to cart");

  setTimeout(() => {
    cartButton.classList.remove("cart-pop");
  }, 300);
});

previousButton?.addEventListener("click", () => {
  moveSlide(-1);
});

nextButton?.addEventListener("click", () => {
  moveSlide(1);
});

dots.forEach((dot, index) => {
  dot.addEventListener("click", () => {
    showSlide(index);
    startSlideTimer();
  });
});

if (contactSection) {
  const contactRevealItems = contactSection.querySelectorAll(
    ".footer-brand, .contact-card, .social-heading, .footer-socials, .footer-bottom"
  );

  contactRevealItems.forEach((item) => item.classList.add("reveal-ready"));

  const revealContactSection = () => {
    contactRevealItems.forEach((item, index) => {
      window.setTimeout(() => {
        item.classList.add("revealed");
      }, index * 95);
    });
  };

  if ("IntersectionObserver" in window) {
    const contactObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealContactSection();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.22 }
    );

    contactObserver.observe(contactSection);
  } else {
    revealContactSection();
  }
}

contactCards.forEach((card) => {
  card.addEventListener("click", async () => {
    const copyValue = card.dataset.copy;

    if (!copyValue || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
      showToast("Contact detail copied");
    } catch {
      showToast("Contact detail selected");
    }
  });
});

socialLinks.forEach((link) => {
  link.addEventListener("click", () => {
    link.classList.add("social-clicked");
    showToast(`Opening ${link.textContent.trim()}`);

    window.setTimeout(() => {
      link.classList.remove("social-clicked");
    }, 420);
  });
});

window.addEventListener("scroll", () => {
  if (!header) {
    return;
  }

  header.classList.toggle("scrolled", window.scrollY > 10);
  updateActiveNavOnScroll();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 980) {
    closeMobileMenu();
  }
});

createPageLoader();
createScrollProgress();
setupScrollReveal();
setupMagneticButtons();
setupTiltCards();
setupRippleEffects();
setupScrollEffects();
setupAutoPageScroll();
showSlide(currentSlide);
startSlideTimer();
updateActiveNavOnScroll();

if (window.lumo?.snake) {
  lumo.snake({
    color: "#000275",
    trailCount: 5,
    magnetic: true,
    size:15,
    hideDefaultCursor: true
  });
}
