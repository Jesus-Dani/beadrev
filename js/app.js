// BeadRev storefront — fetch+cache, grid/filters/modal/cart, WhatsApp checkout.
// Vanilla JS, no dependencies. Reads window.BEADREV_CONFIG and (as a last
// resort) window.BEADREV_SEED, both loaded as plain scripts before this file.

(function () {
  'use strict';

  var CONFIG = window.BEADREV_CONFIG || {};
  var CACHE_KEY = 'beadrev:products:v1';
  var CART_KEY = 'beadrev:cart:v1';
  var THEME_ORDER = ['Success', 'Joy', 'Love', 'Favour', 'Faith', 'Protection'];
  var GRID_WIDTHS = [480, 800, 1200];

  var state = {
    products: [],
    activeFilter: 'All',
    cart: loadCart(),
    quickView: {
      product: null,
      galleryUrls: [],
      activeIndex: 0,
      quantity: 1,
      colour: null,
      size: null,
      triggerEl: null
    }
  };

  var els = {};
  cacheElements();
  init();

  // ----------------------------------------------------------------
  // Bootstrapping
  // ----------------------------------------------------------------

  function cacheElements() {
    [
      'product-grid', 'filters', 'notice-region',
      'hero-video', 'hero-sound-toggle',
      'nav-toggle', 'nav-drawer', 'nav-close',
      'nav-link-story', 'nav-link-shop', 'nav-link-care', 'nav-link-contact',
      'story-modal', 'care-modal', 'contact-modal',
      'cart-toggle', 'cart-count', 'cart-drawer', 'cart-close',
      'cart-items', 'cart-footer', 'cart-subtotal', 'cart-checkout',
      'scrim', 'quick-view', 'qv-close', 'qv-main', 'qv-thumbs',
      'qv-meaning', 'qv-title', 'qv-story', 'qv-description', 'qv-price',
      'qv-colour-group', 'qv-colours', 'qv-size-group', 'qv-sizes',
      'qv-qty-minus', 'qv-qty-plus', 'qv-qty', 'qv-add', 'qv-hint',
      'toast-region', 'sr-announcer',
      'footer-instagram', 'footer-whatsapp', 'footer-year',
      'contact-whatsapp', 'contact-instagram'
    ].forEach(function (id) {
      els[toCamel(id)] = document.getElementById(id);
    });
  }

  function toCamel(id) {
    return id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function init() {
    wireFooter();
    wireReveal();
    wireHeroSound();
    wireOverlayDismiss();
    wireNav();
    wireCart();
    wireQuickView();
    renderCartUI();
    loadProducts();
  }

  function wireFooter() {
    if (els.footerInstagram) els.footerInstagram.href = CONFIG.instagramUrl || '#';
    if (els.footerWhatsapp) els.footerWhatsapp.href = whatsappLink('Hello BeadRev 🌿 I have a question about a piece.');
    if (els.footerYear) els.footerYear.textContent = String(new Date().getFullYear());
    if (els.contactWhatsapp) els.contactWhatsapp.href = whatsappLink('Hello BeadRev 🌿 I have a question about a piece.');
    if (els.contactInstagram) els.contactInstagram.href = CONFIG.instagramUrl || '#';
  }

  function wireHeroSound() {
    if (!els.heroVideo || !els.heroSoundToggle) return;
    els.heroSoundToggle.addEventListener('click', function () {
      var turningOn = els.heroVideo.muted;
      els.heroVideo.muted = !turningOn;
      if (turningOn) els.heroVideo.play().catch(function () {});
      els.heroSoundToggle.setAttribute('aria-pressed', String(turningOn));
      els.heroSoundToggle.textContent = turningOn ? 'Mute video' : 'Tap for sound';
    });
  }

  function wireReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (t) { t.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    Array.prototype.forEach.call(targets, function (t) { observer.observe(t); });
  }

  // ----------------------------------------------------------------
  // Site menu (Our Story / Our Products / Care & Sizing / Contact us)
  // ----------------------------------------------------------------

  function wireNav() {
    if (!els.navToggle || !els.navDrawer) return;

    els.navToggle.addEventListener('click', function () {
      if (els.navDrawer.classList.contains('is-open')) closeNav();
      else openNav();
    });
    els.navClose.addEventListener('click', closeNav);
    els.navDrawer.addEventListener('keydown', trapFocusHandler(els.navDrawer));

    if (els.navLinkShop) {
      els.navLinkShop.addEventListener('click', function () {
        closeNav();
        var target = document.getElementById('shop');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    wireInfoOverlay(els.navLinkStory, els.storyModal, closeStoryModal);
    wireInfoOverlay(els.navLinkCare, els.careModal, closeCareModal);
    wireInfoOverlay(els.navLinkContact, els.contactModal, closeContactModal);
  }

  function wireInfoOverlay(link, modal, closeFn) {
    if (!link || !modal) return;
    link.addEventListener('click', function () {
      closeNav();
      openInfoModal(modal, closeFn, link);
    });
    modal.addEventListener('keydown', trapFocusHandler(modal));
    var closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
  }

  function openNav() {
    els.navDrawer.classList.add('is-open');
    els.navDrawer.setAttribute('aria-hidden', 'false');
    els.navToggle.setAttribute('aria-expanded', 'true');
    lockOverlay(closeNav);
    window.requestAnimationFrame(function () { els.navClose.focus(); });
  }

  function closeNav() {
    if (!els.navDrawer.classList.contains('is-open')) return;
    els.navDrawer.classList.remove('is-open');
    els.navDrawer.setAttribute('aria-hidden', 'true');
    els.navToggle.setAttribute('aria-expanded', 'false');
    unlockOverlay(closeNav);
  }

  function closeStoryModal() { closeInfoModal(els.storyModal, closeStoryModal); }
  function closeCareModal() { closeInfoModal(els.careModal, closeCareModal); }
  function closeContactModal() { closeInfoModal(els.contactModal, closeContactModal); }

  function openInfoModal(modal, closeFn, triggerEl) {
    if (!modal || modal.classList.contains('is-open')) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modal._trigger = triggerEl || null;
    lockOverlay(closeFn);
    window.requestAnimationFrame(function () {
      var closeBtn = modal.querySelector('.modal__close');
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeInfoModal(modal, closeFn) {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    unlockOverlay(closeFn);
    var trigger = modal._trigger;
    modal._trigger = null;
    if (trigger && document.body.contains(trigger)) trigger.focus();
  }

  // ----------------------------------------------------------------
  // Data loading — cache-first render, background refresh, seed fallback
  // ----------------------------------------------------------------

  function loadProducts() {
    var cached = readCache();
    var hadCache = Boolean(cached && Array.isArray(cached.products) && cached.products.length);
    if (hadCache) {
      state.products = sortProducts(cached.products);
      renderShop();
    } else {
      renderSkeleton();
    }
    refreshFromNetwork(hadCache);
  }

  function refreshFromNetwork(hadCache) {
    if (!CONFIG.apiPath) {
      if (!hadCache) useSeed();
      return;
    }
    fetch(CONFIG.apiPath, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('network');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.products)) throw new Error('shape');
        var incoming = sortProducts(data.products);
        var changed = !hadCache || JSON.stringify(incoming) !== JSON.stringify(state.products);
        state.products = incoming;
        writeCache(data);
        clearNotice();
        if (changed) renderShop();
      })
      .catch(function () {
        if (!hadCache) useSeed();
      });
  }

  function useSeed() {
    var seed = window.BEADREV_SEED;
    if (seed && Array.isArray(seed.products) && seed.products.length) {
      state.products = sortProducts(seed.products);
      renderShop();
      showNotice('Showing a saved version of the shop — we’ll refresh once we’re back online.');
    } else {
      state.products = [];
      renderShop();
    }
  }

  function sortProducts(list) {
    return list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (err) { /* storage unavailable */ }
  }

  // ----------------------------------------------------------------
  // Notices
  // ----------------------------------------------------------------

  function showNotice(message) {
    if (!els.noticeRegion) return;
    els.noticeRegion.innerHTML = '';
    var notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent = message;
    els.noticeRegion.appendChild(notice);
  }

  function clearNotice() {
    if (els.noticeRegion) els.noticeRegion.innerHTML = '';
  }

  // ----------------------------------------------------------------
  // Shop rendering — filters + grid + skeletons
  // ----------------------------------------------------------------

  function renderShop() {
    renderFilters();
    renderGrid();
  }

  function renderSkeleton() {
    if (!els.productGrid) return;
    els.productGrid.setAttribute('aria-busy', 'true');
    els.productGrid.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var card = document.createElement('div');
      card.className = 'skeleton-card';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML =
        '<div class="skeleton-card__frame"></div>' +
        '<div class="skeleton-card__line"></div>' +
        '<div class="skeleton-card__line skeleton-card__line--short"></div>' +
        '<div class="skeleton-card__line skeleton-card__line--tiny"></div>';
      els.productGrid.appendChild(card);
    }
  }

  function renderFilters() {
    if (!els.filters) return;
    var present = {};
    state.products.forEach(function (p) {
      (p.themes || []).forEach(function (t) { present[t] = true; });
    });
    var ordered = THEME_ORDER.filter(function (t) { return present[t]; });
    var extra = Object.keys(present)
      .filter(function (t) { return THEME_ORDER.indexOf(t) === -1; })
      .sort();
    var themes = ['All'].concat(ordered, extra);

    if (themes.indexOf(state.activeFilter) === -1) state.activeFilter = 'All';

    els.filters.innerHTML = '';
    themes.forEach(function (theme) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-chip';
      btn.textContent = theme;
      btn.setAttribute('aria-pressed', String(theme === state.activeFilter));
      btn.addEventListener('click', function () {
        if (state.activeFilter === theme) return;
        state.activeFilter = theme;
        renderFilters();
        renderGrid();
      });
      els.filters.appendChild(btn);
    });
  }

  function renderGrid() {
    if (!els.productGrid) return;
    els.productGrid.setAttribute('aria-busy', 'false');
    els.productGrid.innerHTML = '';

    var visible = state.activeFilter === 'All'
      ? state.products
      : state.products.filter(function (p) { return (p.themes || []).indexOf(state.activeFilter) !== -1; });

    if (!visible.length) {
      var empty = document.createElement('p');
      empty.className = 'no-results';
      empty.textContent = state.products.length
        ? 'No pieces in “' + state.activeFilter + '” yet — try another meaning.'
        : 'New pieces are on their way — check back soon.';
      els.productGrid.appendChild(empty);
      return;
    }

    visible.forEach(function (product, index) {
      els.productGrid.appendChild(buildProductCard(product, index));
    });
  }

  function buildProductCard(product, index) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'product-card';
    card.dataset.soldOut = String(!product.inStock);
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-label', 'Quick view — ' + product.name + ', ' + product.meaning + ', ' + formatNaira(product.price) + (product.inStock ? '' : ', sold out'));

    var frame = buildImageFrame(product, { eager: index < 3 });
    if (!product.inStock) {
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Sold out';
      frame.appendChild(badge);
    }
    card.appendChild(frame);

    card.appendChild(textEl('p', 'product-card__name', product.name, { lang: 'yo' }));
    card.appendChild(textEl('p', 'product-card__meaning', product.meaning));
    card.appendChild(textEl('p', 'product-card__tagline', product.tagline));
    card.appendChild(textEl('p', 'product-card__price', formatNaira(product.price)));

    card.addEventListener('click', function () { openQuickView(product, card); });
    return card;
  }

  function textEl(tag, className, text, attrs) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text || '';
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    }
    return el;
  }

  // ----------------------------------------------------------------
  // Image handling — Cloudinary URLs, blur-up frames, placeholders
  // ----------------------------------------------------------------

  function cloudinaryUrl(publicId, width) {
    return 'https://res.cloudinary.com/' + CONFIG.cloudName + '/image/upload/f_auto,q_auto,w_' + width + '/' + publicId;
  }

  function cloudinaryBlurUrl(publicId) {
    return 'https://res.cloudinary.com/' + CONFIG.cloudName + '/image/upload/e_blur:1000,q_1,w_40/' + publicId;
  }

  function buildImageFrame(product, opts) {
    opts = opts || {};
    var frame = document.createElement('div');
    frame.className = 'product-card__frame';

    if (!product.image) {
      frame.appendChild(buildPlaceholder(product));
      return frame;
    }

    frame.style.backgroundImage = 'url("' + cloudinaryBlurUrl(product.image) + '")';
    frame.style.backgroundSize = 'cover';
    frame.style.backgroundPosition = 'center';

    var img = document.createElement('img');
    img.className = 'product-card__image';
    img.dataset.loaded = 'false';
    img.alt = product.name + ' — ' + product.meaning;
    img.width = 800;
    img.height = 1000;
    img.loading = opts.eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.sizes = '(min-width: 980px) 33vw, (min-width: 620px) 50vw, 100vw';
    img.srcset = GRID_WIDTHS.map(function (w) { return cloudinaryUrl(product.image, w) + ' ' + w + 'w'; }).join(', ');
    img.src = cloudinaryUrl(product.image, 800);
    img.addEventListener('load', function () { img.dataset.loaded = 'true'; }, { once: true });
    frame.appendChild(img);
    return frame;
  }

  function buildPlaceholder(product) {
    var placeholder = document.createElement('div');
    placeholder.className = 'product-card__placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = product.name;
    return placeholder;
  }

  // ----------------------------------------------------------------
  // Quick-view modal
  // ----------------------------------------------------------------

  function wireQuickView() {
    els.qvClose.addEventListener('click', closeQuickView);
    els.quickView.addEventListener('keydown', trapFocusHandler(els.quickView));

    els.qvQtyMinus.addEventListener('click', function () { setQuantity(state.quickView.quantity - 1); });
    els.qvQtyPlus.addEventListener('click', function () { setQuantity(state.quickView.quantity + 1); });
    els.qvAdd.addEventListener('click', handleAddToCart);

    els.qvMain.addEventListener('click', toggleZoom);
    wirePinchZoom(els.qvMain);
  }

  function openQuickView(product, triggerEl) {
    var qv = state.quickView;
    qv.product = product;
    qv.galleryUrls = buildGalleryUrls(product);
    qv.activeIndex = 0;
    qv.quantity = 1;
    qv.colour = null;
    qv.size = null;
    qv.triggerEl = triggerEl || null;

    els.qvMeaning.textContent = product.meaning;
    els.qvTitle.textContent = product.name;
    els.qvTitle.lang = 'yo';
    els.qvStory.textContent = expandedMeaning(product);
    els.qvDescription.textContent = product.description;
    els.qvPrice.textContent = formatNaira(product.price) + (product.inStock ? '' : ' · Sold out');
    els.qvHint.textContent = '';

    renderGalleryMain();
    renderGalleryThumbs();
    renderOptionGroup(els.qvColourGroup, els.qvColours, product.colours, 'colour');
    renderOptionGroup(els.qvSizeGroup, els.qvSizes, product.sizes, 'size');
    setQuantity(1);
    updateAddButtonState();

    els.quickView.classList.add('is-open');
    els.quickView.setAttribute('aria-hidden', 'false');
    lockOverlay(closeQuickView);

    window.requestAnimationFrame(function () { els.qvClose.focus(); });
  }

  function closeQuickView() {
    if (!els.quickView.classList.contains('is-open')) return;
    els.quickView.classList.remove('is-open');
    els.quickView.setAttribute('aria-hidden', 'true');
    unlockOverlay(closeQuickView);
    var trigger = state.quickView.triggerEl;
    state.quickView.product = null;
    if (trigger && document.body.contains(trigger)) trigger.focus();
  }

  function buildGalleryUrls(product) {
    var ids = [product.image].concat(product.gallery || []).filter(Boolean);
    return ids.map(function (id) {
      return { id: id, full: cloudinaryUrl(id, 1200), thumb: cloudinaryUrl(id, 160) };
    });
  }

  function renderGalleryMain() {
    var qv = state.quickView;
    els.qvMain.innerHTML = '';
    els.qvMain.style.setProperty('--zoom-scale', '1');
    els.qvMain.classList.remove('is-zoomed');

    if (!qv.galleryUrls.length) {
      els.qvMain.appendChild(buildPlaceholder(qv.product));
      return;
    }
    var entry = qv.galleryUrls[qv.activeIndex];
    var img = document.createElement('img');
    img.src = entry.full;
    img.alt = qv.product.name + ' — detail view';
    img.width = 800;
    img.height = 1000;
    img.decoding = 'async';
    els.qvMain.appendChild(img);
  }

  function renderGalleryThumbs() {
    var qv = state.quickView;
    els.qvThumbs.innerHTML = '';
    if (qv.galleryUrls.length < 2) return;

    qv.galleryUrls.forEach(function (entry, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal__thumb';
      btn.setAttribute('aria-current', String(index === qv.activeIndex));
      btn.setAttribute('aria-label', 'Show image ' + (index + 1) + ' of ' + qv.galleryUrls.length);
      var img = document.createElement('img');
      img.src = entry.thumb;
      img.alt = '';
      img.width = 64;
      img.height = 64;
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', function () {
        qv.activeIndex = index;
        renderGalleryMain();
        renderGalleryThumbs();
      });
      els.qvThumbs.appendChild(btn);
    });
  }

  // -- Zoom: click/tap toggles a fixed zoom level; pinch scales continuously.
  // Both drive the same --zoom-scale custom property so they never conflict.

  function setZoom(mainEl, scale) {
    var clamped = Math.max(1, Math.min(2.4, scale));
    mainEl.style.setProperty('--zoom-scale', String(clamped));
    mainEl.classList.toggle('is-zoomed', clamped > 1.04);
    return clamped;
  }

  function currentZoom(mainEl) {
    return parseFloat(mainEl.style.getPropertyValue('--zoom-scale')) || 1;
  }

  function toggleZoom() {
    if (!state.quickView.galleryUrls.length) return;
    setZoom(els.qvMain, currentZoom(els.qvMain) > 1.04 ? 1 : 1.8);
  }

  function wirePinchZoom(mainEl) {
    var startDistance = 0;
    var startScale = 1;
    mainEl.addEventListener('touchstart', function (event) {
      if (event.touches.length === 2) {
        startDistance = touchDistance(event.touches);
        startScale = currentZoom(mainEl);
      }
    }, { passive: true });
    mainEl.addEventListener('touchmove', function (event) {
      if (event.touches.length === 2 && startDistance) {
        setZoom(mainEl, startScale * (touchDistance(event.touches) / startDistance));
      }
    }, { passive: true });
    mainEl.addEventListener('touchend', function (event) {
      if (event.touches.length < 2) startDistance = 0;
    }, { passive: true });
  }

  function touchDistance(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function expandedMeaning(product) {
    var tagline = product.tagline || '';
    var lowered = tagline ? tagline.charAt(0).toLowerCase() + tagline.slice(1) : '';
    return '“' + product.meaning + '” — a small word carrying a big wish. ' +
      (lowered ? 'This one is ' + lowered : '');
  }

  function renderOptionGroup(groupEl, listEl, options, kind) {
    listEl.innerHTML = '';
    if (!options || !options.length) {
      groupEl.hidden = true;
      return;
    }
    groupEl.hidden = false;

    options.forEach(function (option) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');

      if (kind === 'colour') {
        btn.className = 'swatch';
        var dot = document.createElement('span');
        dot.className = 'swatch__dot';
        dot.style.setProperty('--swatch-colour', cssColour(option));
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(option));
      } else {
        btn.className = 'size-chip';
        btn.textContent = option;
      }

      btn.addEventListener('click', function () {
        var current = kind === 'colour' ? state.quickView.colour : state.quickView.size;
        var next = current === option ? null : option;
        if (kind === 'colour') state.quickView.colour = next;
        else state.quickView.size = next;

        Array.prototype.forEach.call(listEl.children, function (child) {
          child.setAttribute('aria-pressed', String(child === btn && next !== null));
        });
        els.qvHint.textContent = '';
        updateAddButtonState();
      });
      listEl.appendChild(btn);
    });
  }

  function cssColour(name) {
    var map = {
      brown: '#8C5A3C', amber: '#C9923A', gold: '#CBA135', cream: '#EFE6D3',
      pink: '#E3AFAE', white: '#F4F1EA', red: '#A8453A', orange: '#D98A4B',
      green: '#7C8E6B', blue: '#7C95AE', black: '#2B2723', bronze: '#8A6A3F'
    };
    return map[String(name).toLowerCase()] || '#D8D1C2';
  }

  function setQuantity(value) {
    state.quickView.quantity = Math.max(1, Math.min(99, value));
    els.qvQty.textContent = String(state.quickView.quantity);
    els.qvQtyMinus.disabled = state.quickView.quantity <= 1;
  }

  function updateAddButtonState() {
    var product = state.quickView.product;
    if (!product) return;
    els.qvAdd.disabled = !product.inStock;
    els.qvAdd.textContent = product.inStock ? 'Add to cart' : 'Sold out';
  }

  function handleAddToCart() {
    var qv = state.quickView;
    var product = qv.product;
    if (!product || !product.inStock) return;

    var needsColour = Boolean(product.colours && product.colours.length);
    var needsSize = Boolean(product.sizes && product.sizes.length);
    var missingColour = needsColour && !qv.colour;
    var missingSize = needsSize && !qv.size;

    if (missingColour || missingSize) {
      var what = missingColour && missingSize ? 'a colour and a size'
        : (missingColour ? 'a colour' : 'a size');
      els.qvHint.textContent = 'Please choose ' + what + ' before adding to cart.';
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      colour: qv.colour,
      size: qv.size,
      qty: qv.quantity
    });

    bumpCartBadge();
    showToast('Added to cart');
    announce(product.name + ' added to your cart.');
    closeQuickView();
  }

  // ----------------------------------------------------------------
  // Shared overlay machinery (scrim, scroll lock, dismiss) — every
  // modal/drawer shares one scrim and stacks on a single close stack
  // so Escape/scrim-click always dismiss the topmost overlay.
  // ----------------------------------------------------------------

  var overlayCloseStack = [];

  function lockOverlay(closeFn) {
    if (overlayCloseStack.indexOf(closeFn) === -1) overlayCloseStack.push(closeFn);
    els.scrim.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function unlockOverlay(closeFn) {
    var index = overlayCloseStack.indexOf(closeFn);
    if (index !== -1) overlayCloseStack.splice(index, 1);
    if (!overlayCloseStack.length) {
      els.scrim.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  function closeTopOverlay() {
    var top = overlayCloseStack[overlayCloseStack.length - 1];
    if (top) top();
  }

  function wireOverlayDismiss() {
    els.scrim.addEventListener('click', closeTopOverlay);
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      closeTopOverlay();
    });
  }

  // ----------------------------------------------------------------
  // Focus trap (shared by modal & cart drawer)
  // ----------------------------------------------------------------

  function trapFocusHandler(container) {
    return function (event) {
      if (event.key !== 'Tab') return;
      var focusable = container.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
  }

  // ----------------------------------------------------------------
  // Cart
  // ----------------------------------------------------------------

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) { return []; }
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (err) { /* storage unavailable */ }
  }

  function cartLineKey(item) {
    return [item.id, item.colour || '', item.size || ''].join('::');
  }

  function addToCart(item) {
    var key = cartLineKey(item);
    var existing = null;
    for (var i = 0; i < state.cart.length; i++) {
      if (cartLineKey(state.cart[i]) === key) { existing = state.cart[i]; break; }
    }
    if (existing) {
      existing.qty = Math.min(99, existing.qty + item.qty);
    } else {
      state.cart.push(item);
    }
    saveCart();
    renderCartUI();
  }

  function removeFromCart(key) {
    state.cart = state.cart.filter(function (line) { return cartLineKey(line) !== key; });
    saveCart();
    renderCartUI();
  }

  function cartCount() {
    return state.cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function cartSubtotal() {
    return state.cart.reduce(function (sum, line) { return sum + line.qty * line.price; }, 0);
  }

  function wireCart() {
    els.cartToggle.addEventListener('click', openCart);
    els.cartClose.addEventListener('click', closeCart);
    els.cartDrawer.addEventListener('keydown', trapFocusHandler(els.cartDrawer));
    els.cartCheckout.addEventListener('click', handleCheckout);
  }

  function openCart() {
    els.cartDrawer.classList.add('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    els.cartToggle.setAttribute('aria-expanded', 'true');
    lockOverlay(closeCart);
    window.requestAnimationFrame(function () { els.cartClose.focus(); });
  }

  function closeCart() {
    if (!els.cartDrawer.classList.contains('is-open')) return;
    els.cartDrawer.classList.remove('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    els.cartToggle.setAttribute('aria-expanded', 'false');
    unlockOverlay(closeCart);
    els.cartToggle.focus();
  }

  function renderCartUI() {
    els.cartCount.textContent = String(cartCount());
    els.cartItems.innerHTML = '';

    if (!state.cart.length) {
      els.cartFooter.hidden = true;
      var empty = document.createElement('p');
      empty.className = 'cart-drawer__empty';
      empty.textContent = 'Your cart is empty — explore the pieces and find one that means something.';
      els.cartItems.appendChild(empty);
      return;
    }

    els.cartFooter.hidden = false;
    state.cart.forEach(function (line) {
      els.cartItems.appendChild(buildCartLine(line));
    });
    els.cartSubtotal.textContent = formatNaira(cartSubtotal());
  }

  function buildCartLine(line) {
    var row = document.createElement('div');
    row.className = 'cart-item';

    var thumb = document.createElement('div');
    thumb.className = 'cart-item__thumb';
    if (line.image) {
      var img = document.createElement('img');
      img.src = cloudinaryUrl(line.image, 160);
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      var placeholder = document.createElement('div');
      placeholder.className = 'product-card__placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = line.name.charAt(0);
      thumb.appendChild(placeholder);
    }

    var meta = document.createElement('div');
    meta.appendChild(textEl('p', 'cart-item__name', line.name, { lang: 'yo' }));
    var metaParts = [];
    if (line.colour) metaParts.push(line.colour);
    if (line.size) metaParts.push('Size ' + line.size);
    metaParts.push('Qty ' + line.qty);
    meta.appendChild(textEl('p', 'cart-item__meta', metaParts.join(' · ')));

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cart-item__remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function () {
      removeFromCart(cartLineKey(line));
      announce(line.name + ' removed from your cart.');
    });
    meta.appendChild(removeBtn);

    var price = textEl('p', 'cart-item__price', formatNaira(line.qty * line.price));

    row.appendChild(thumb);
    row.appendChild(meta);
    row.appendChild(price);
    return row;
  }

  function bumpCartBadge() {
    els.cartCount.classList.remove('is-bumped');
    void els.cartCount.offsetWidth; // restart the animation
    els.cartCount.classList.add('is-bumped');
  }

  // ----------------------------------------------------------------
  // WhatsApp checkout
  // ----------------------------------------------------------------

  function whatsappLink(message) {
    var number = CONFIG.whatsappNumber || '';
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
  }

  function buildOrderMessage() {
    var lines = state.cart.map(function (line) {
      var bits = [line.name];
      if (line.colour) bits.push(line.colour);
      if (line.size) bits.push(line.size);
      return '• ' + bits.join(' — ') + ' ×' + line.qty + ' — ' + formatNaira(line.qty * line.price);
    });
    return [
      'Hello BeadRev 🌿 I\'d like to order:',
      lines.join('\n'),
      'Total: ' + formatNaira(cartSubtotal()),
      '(sent from beadrev-ng)'
    ].join('\n');
  }

  function handleCheckout() {
    if (!state.cart.length || els.cartCheckout.dataset.loading === 'true') return;
    els.cartCheckout.dataset.loading = 'true';
    var url = whatsappLink(buildOrderMessage());
    window.setTimeout(function () {
      window.open(url, '_blank', 'noopener');
      delete els.cartCheckout.dataset.loading;
    }, 200);
  }

  // ----------------------------------------------------------------
  // Toasts & screen-reader announcements
  // ----------------------------------------------------------------

  function showToast(message, variant) {
    var toast = document.createElement('div');
    toast.className = 'toast' + (variant === 'error' ? ' toast--error' : '');
    toast.textContent = message;
    els.toastRegion.appendChild(toast);
    window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    window.setTimeout(function () {
      toast.classList.remove('is-visible');
      window.setTimeout(function () { toast.remove(); }, 260);
    }, 2600);
  }

  function announce(message) {
    els.srAnnouncer.textContent = '';
    window.requestAnimationFrame(function () { els.srAnnouncer.textContent = message; });
  }

  // ----------------------------------------------------------------
  // Formatting
  // ----------------------------------------------------------------

  function formatNaira(amount) {
    var n = Number(amount) || 0;
    return '₦' + n.toLocaleString('en-NG');
  }
})();
