// BeadRev admin — password gate, CRUD + reorder, Cloudinary upload, save.
// Vanilla JS. The admin password lives only in memory for this session;
// it is verified server-side (by the Function) on every save.

(function () {
  'use strict';

  var CONFIG = window.BEADREV_CONFIG || {};
  var DRAFT_KEY = 'beadrev:admin:draft:v1';
  var THUMB_WIDTH = 160;
  var PREVIEW_WIDTH = 320;

  var sessionPassword = null;
  var products = [];
  var editingId = null;
  var formState = { image: '' };

  var els = {};
  var themesInput, coloursInput, sizesInput;

  cacheElements();
  init();

  // ----------------------------------------------------------------
  // Bootstrapping
  // ----------------------------------------------------------------

  function cacheElements() {
    [
      'admin-gate', 'gate-form', 'gate-password', 'gate-hint',
      'admin-main', 'admin-status', 'admin-notice',
      'admin-list', 'admin-add-btn',
      'admin-form-section', 'admin-form', 'admin-form-title',
      'f-name', 'f-meaning', 'f-type', 'f-tagline', 'f-description',
      'f-price', 'f-instock',
      'f-themes', 'f-themes-input', 'f-colours', 'f-colours-input',
      'f-sizes', 'f-sizes-input',
      'image-drop', 'image-drop-text', 'image-preview', 'image-input', 'image-hint',
      'form-save-btn', 'form-cancel-btn', 'form-delete-btn',
      'admin-save-all', 'admin-save-hint',
      'toast-region', 'sr-announcer'
    ].forEach(function (id) {
      els[toCamel(id)] = document.getElementById(id);
    });
  }

  function toCamel(id) {
    return id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function init() {
    wireGate();
    wireList();
    wireForm();
    wireImageUpload();
    wireSaveAll();

    themesInput = createChipInput(els.fThemes, els.fThemesInput);
    coloursInput = createChipInput(els.fColours, els.fColoursInput);
    sizesInput = createChipInput(els.fSizes, els.fSizesInput);
  }

  // ----------------------------------------------------------------
  // Password gate
  // ----------------------------------------------------------------

  function wireGate() {
    els.gateForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = els.gatePassword.value;
      if (!value) return;
      sessionPassword = value;
      els.gatePassword.value = '';
      els.gateHint.textContent = '';
      enterAdmin();
    });
  }

  function enterAdmin() {
    els.adminGate.hidden = true;
    els.adminMain.hidden = false;
    if (!products.length) loadProducts();
    window.requestAnimationFrame(function () { els.adminAddBtn.focus(); });
  }

  function showGate(message) {
    els.adminMain.hidden = true;
    els.adminGate.hidden = false;
    els.gateHint.textContent = message || '';
    window.requestAnimationFrame(function () { els.gatePassword.focus(); });
  }

  // ----------------------------------------------------------------
  // Loading the catalogue (live, with local-draft fallback)
  // ----------------------------------------------------------------

  function loadProducts() {
    els.adminStatus.textContent = 'Loading products…';
    if (!CONFIG.apiPath) {
      useDraftOrEmpty('BeadRev isn’t configured yet — check js/config.js.');
      return;
    }
    fetch(CONFIG.apiPath, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('network');
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.products)) throw new Error('shape');
        products = sortProducts(data.products);
        saveDraft();
        clearNotice();
        els.adminStatus.textContent = describeCount(products.length) + ' loaded.';
        renderList();
      })
      .catch(function () {
        useDraftOrEmpty('Could not reach BeadRev — showing your last local draft. Changes will sync once you save.');
      });
  }

  function useDraftOrEmpty(message) {
    var draft = loadDraft();
    if (draft && draft.length) {
      products = draft;
      els.adminStatus.textContent = describeCount(products.length) + ' loaded from your local draft.';
      showNotice(message);
    } else {
      products = [];
      els.adminStatus.textContent = 'No products loaded yet.';
      showNotice(message);
    }
    renderList();
  }

  function describeCount(n) {
    return n + (n === 1 ? ' piece' : ' pieces');
  }

  function sortProducts(list) {
    return list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(products)); } catch (err) { /* storage unavailable */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) { return null; }
  }

  function showNotice(message) {
    els.adminNotice.innerHTML = '';
    var notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent = message;
    els.adminNotice.appendChild(notice);
  }

  function clearNotice() {
    els.adminNotice.innerHTML = '';
  }

  // ----------------------------------------------------------------
  // Product list — view, reorder, edit entry points
  // ----------------------------------------------------------------

  function wireList() {
    els.adminAddBtn.addEventListener('click', function () { openForm(null); });
  }

  function renderList() {
    els.adminList.innerHTML = '';
    if (!products.length) {
      var empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'No pieces yet — add your first one below.';
      els.adminList.appendChild(empty);
      return;
    }
    products.forEach(function (product, index) {
      els.adminList.appendChild(buildAdminCard(product, index, products.length));
    });
  }

  function buildAdminCard(product, index, total) {
    var card = document.createElement('div');
    card.className = 'admin-card';

    var thumb = document.createElement('div');
    thumb.className = 'admin-card__thumb';
    thumb.appendChild(buildThumb(product));

    var info = document.createElement('div');
    info.appendChild(textEl('p', 'admin-card__name', product.name, { lang: 'yo' }));
    info.appendChild(textEl('p', 'admin-card__meta',
      product.meaning + ' · ' + formatNaira(product.price) + ' · ' + (product.inStock ? 'In stock' : 'Sold out')));

    var actions = document.createElement('div');
    actions.className = 'admin-card__actions';

    var upBtn = orderButton('↑', 'Move ' + product.name + ' up', index === 0, function () { moveProduct(product.id, -1); });
    var downBtn = orderButton('↓', 'Move ' + product.name + ' down', index === total - 1, function () { moveProduct(product.id, 1); });

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost btn--small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () { openForm(product); });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(editBtn);

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  function orderButton(symbol, label, disabled, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-card__order-btn';
    btn.setAttribute('aria-label', label);
    btn.textContent = symbol;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function buildThumb(product) {
    if (product.image) {
      var img = document.createElement('img');
      img.src = cloudinaryUrl(product.image, THUMB_WIDTH);
      img.alt = '';
      img.loading = 'lazy';
      return img;
    }
    var placeholder = document.createElement('div');
    placeholder.className = 'product-card__placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = product.name.charAt(0);
    return placeholder;
  }

  function moveProduct(id, direction) {
    var index = indexOf(id);
    var swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= products.length) return;
    var temp = products[index];
    products[index] = products[swapIndex];
    products[swapIndex] = temp;
    reindexOrder();
    saveDraft();
    renderList();
  }

  function reindexOrder() {
    products.forEach(function (p, i) { p.order = i + 1; });
  }

  function indexOf(id) {
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === id) return i;
    }
    return -1;
  }

  function findProduct(id) {
    var index = indexOf(id);
    return index === -1 ? null : products[index];
  }

  // ----------------------------------------------------------------
  // Add / edit form
  // ----------------------------------------------------------------

  function wireForm() {
    els.adminForm.addEventListener('submit', handleFormSubmit);
    els.formCancelBtn.addEventListener('click', closeForm);
    els.formDeleteBtn.addEventListener('click', handleDelete);
  }

  function openForm(product) {
    editingId = product ? product.id : null;
    formState.image = product ? (product.image || '') : '';

    els.adminFormTitle.textContent = product ? 'Edit piece' : 'Add a piece';
    els.fName.value = product ? product.name : '';
    els.fMeaning.value = product ? product.meaning : '';
    els.fTagline.value = product ? product.tagline : '';
    els.fDescription.value = product ? (product.description || '') : '';
    els.fType.value = product ? product.type : 'bracelet';
    els.fPrice.value = product ? String(product.price) : '';
    els.fInstock.checked = product ? Boolean(product.inStock) : true;

    themesInput.setValues(product ? product.themes : []);
    coloursInput.setValues(product ? product.colours : []);
    sizesInput.setValues(product ? product.sizes : []);

    showImagePreview(formState.image);
    els.imageHint.textContent = '';

    els.formDeleteBtn.hidden = !product;
    els.adminFormSection.hidden = false;
    scrollToForm();
    els.fName.focus();
  }

  function closeForm() {
    els.adminFormSection.hidden = true;
    els.adminForm.reset();
    editingId = null;
    formState.image = '';
    themesInput.setValues([]);
    coloursInput.setValues([]);
    sizesInput.setValues([]);
    showImagePreview('');
    els.imageHint.textContent = '';
  }

  function scrollToForm() {
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.adminFormSection.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    var name = els.fName.value.trim();
    var meaning = els.fMeaning.value.trim();
    var tagline = els.fTagline.value.trim();
    var price = Number(els.fPrice.value);

    if (!name || !meaning || !tagline || !isFinite(price) || price < 0) {
      showToast('Please fill in name, meaning, tagline and a valid price.', 'error');
      return;
    }

    var existing = editingId ? findProduct(editingId) : null;
    var product = {
      id: editingId || uniqueSlug(name),
      name: name,
      meaning: meaning,
      tagline: tagline,
      description: els.fDescription.value.trim(),
      type: els.fType.value,
      themes: themesInput.getValues(),
      price: Math.round(price),
      colours: coloursInput.getValues(),
      sizes: sizesInput.getValues(),
      image: formState.image || '',
      gallery: existing ? (existing.gallery || []) : [],
      inStock: els.fInstock.checked,
      order: existing ? existing.order : nextOrder()
    };

    if (existing) {
      products[indexOf(existing.id)] = product;
    } else {
      products.push(product);
    }

    saveDraft();
    renderList();
    closeForm();
    announce(product.name + (existing ? ' updated.' : ' added.'));
    showToast(existing ? 'Piece updated — remember to save the catalogue.' : 'Piece added — remember to save the catalogue.');
  }

  function nextOrder() {
    if (!products.length) return 1;
    return Math.max.apply(null, products.map(function (p) { return p.order || 0; })) + 1;
  }

  function handleDelete() {
    if (!editingId) return;
    var product = findProduct(editingId);
    if (!product) return;
    if (!window.confirm('Delete "' + product.name + '"? This takes effect once you save the catalogue.')) return;

    products = products.filter(function (p) { return p.id !== editingId; });
    reindexOrder();
    saveDraft();
    renderList();
    closeForm();
    announce(product.name + ' deleted.');
    showToast('Piece deleted — remember to save the catalogue.');
  }

  function slugify(text) {
    var base = text
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
    return base || 'piece';
  }

  function uniqueSlug(name) {
    var base = slugify(name);
    var slug = base;
    var n = 2;
    while (findProduct(slug)) {
      slug = base + '-' + n;
      n += 1;
    }
    return slug;
  }

  // ----------------------------------------------------------------
  // Chip input (themes / colours / sizes) — type, Enter to add, ✕ to remove
  // ----------------------------------------------------------------

  function createChipInput(containerEl, inputEl) {
    var values = [];

    function render() {
      var chips = containerEl.querySelectorAll('.chip-input__chip');
      Array.prototype.forEach.call(chips, function (chip) { chip.remove(); });
      values.forEach(function (value, index) {
        var chip = document.createElement('span');
        chip.className = 'chip-input__chip';
        chip.appendChild(document.createTextNode(value));

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', 'Remove ' + value);
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', function () {
          values.splice(index, 1);
          render();
          inputEl.focus();
        });

        chip.appendChild(removeBtn);
        containerEl.insertBefore(chip, inputEl);
      });
    }

    function commit() {
      var raw = inputEl.value.trim().replace(/,+$/, '').trim();
      if (raw && values.indexOf(raw) === -1) values.push(raw);
      inputEl.value = '';
      render();
    }

    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Backspace' && !inputEl.value && values.length) {
        values.pop();
        render();
      }
    });
    inputEl.addEventListener('blur', function () {
      if (inputEl.value.trim()) commit();
    });

    return {
      getValues: function () { return values.slice(); },
      setValues: function (next) { values = (next || []).slice(); render(); }
    };
  }

  // ----------------------------------------------------------------
  // Cloudinary image upload (unsigned)
  // ----------------------------------------------------------------

  function wireImageUpload() {
    els.imageDrop.addEventListener('click', function () { els.imageInput.click(); });
    els.imageDrop.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        els.imageInput.click();
      }
    });
    els.imageDrop.addEventListener('dragover', function (event) {
      event.preventDefault();
      els.imageDrop.classList.add('is-dragover');
    });
    ['dragleave', 'drop'].forEach(function (type) {
      els.imageDrop.addEventListener(type, function () { els.imageDrop.classList.remove('is-dragover'); });
    });
    els.imageDrop.addEventListener('drop', function (event) {
      event.preventDefault();
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });
    els.imageInput.addEventListener('change', function () {
      var file = els.imageInput.files && els.imageInput.files[0];
      if (file) handleImageFile(file);
    });
  }

  function handleImageFile(file) {
    if (!/^image\//.test(file.type)) {
      els.imageHint.textContent = 'Please choose an image file.';
      return;
    }
    if (!CONFIG.cloudName || !CONFIG.uploadPreset) {
      els.imageHint.textContent = 'Image upload isn’t configured — check js/config.js.';
      return;
    }

    els.imageHint.textContent = 'Uploading photo…';
    els.imageDropText.textContent = 'Uploading…';

    var formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.uploadPreset);

    fetch('https://api.cloudinary.com/v1_1/' + CONFIG.cloudName + '/image/upload', {
      method: 'POST',
      body: formData
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.public_id) {
          var serverMessage = result.data && result.data.error && result.data.error.message;
          throw new Error(serverMessage || 'upload-failed');
        }
        formState.image = result.data.public_id;
        showImagePreview(formState.image);
        els.imageHint.textContent = 'Photo uploaded.';
      })
      .catch(function (err) {
        var detail = err && err.message && err.message !== 'upload-failed' ? err.message : null;
        els.imageHint.textContent = detail
          ? 'Upload failed: ' + detail + ' — check the upload preset settings in Cloudinary.'
          : 'Upload failed — check your connection and try again.';
        els.imageDropText.textContent = 'Drag a photo here, or click to choose one';
      });
  }

  function showImagePreview(publicId) {
    els.imagePreview.innerHTML = '';
    var hasImage = Boolean(publicId);
    els.imagePreview.hidden = !hasImage;
    els.imageDropText.hidden = hasImage;
    if (!hasImage) {
      els.imageDropText.textContent = 'Drag a photo here, or click to choose one';
      return;
    }
    var img = document.createElement('img');
    img.src = cloudinaryUrl(publicId, PREVIEW_WIDTH);
    img.alt = '';
    els.imagePreview.appendChild(img);
  }

  function cloudinaryUrl(publicId, width) {
    return 'https://res.cloudinary.com/' + CONFIG.cloudName + '/image/upload/f_auto,q_auto,w_' + width + '/' + publicId;
  }

  // ----------------------------------------------------------------
  // Save catalogue
  // ----------------------------------------------------------------

  function wireSaveAll() {
    els.adminSaveAll.addEventListener('click', handleSaveAll);
  }

  function handleSaveAll() {
    if (els.adminSaveAll.dataset.loading === 'true') return;
    if (!sessionPassword) {
      showGate('Please enter the admin password to save.');
      return;
    }

    els.adminSaveAll.dataset.loading = 'true';
    els.adminSaveHint.textContent = '';

    fetch(CONFIG.apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: sessionPassword, products: products })
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        delete els.adminSaveAll.dataset.loading;

        if (result.ok && result.data && result.data.ok) {
          els.adminSaveHint.textContent = 'Saved just now — it’s live on the shop.';
          announce('Catalogue saved.');
          showToast('Catalogue saved — it’s live on the shop.');
          return;
        }
        if (result.status === 401) {
          sessionPassword = null;
          els.adminSaveHint.textContent = 'Not saved — wrong password.';
          showToast('Wrong password — please re-enter it to save.', 'error');
          showGate('That password was rejected — please re-enter it to save your changes.');
          return;
        }
        throw new Error('save-failed');
      })
      .catch(function () {
        delete els.adminSaveAll.dataset.loading;
        els.adminSaveHint.textContent = 'Not saved — your changes are kept on this device. Try again shortly.';
        showToast('Could not save right now — your changes are kept locally.', 'error');
      });
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
    }, 3000);
  }

  function announce(message) {
    els.srAnnouncer.textContent = '';
    window.requestAnimationFrame(function () { els.srAnnouncer.textContent = message; });
  }

  // ----------------------------------------------------------------
  // Small helpers
  // ----------------------------------------------------------------

  function textEl(tag, className, text, attrs) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text || '';
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    }
    return el;
  }

  function formatNaira(amount) {
    var n = Number(amount) || 0;
    return '₦' + n.toLocaleString('en-NG');
  }
})();
