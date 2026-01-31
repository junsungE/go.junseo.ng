const form = document.getElementById("createForm");
const msg = document.getElementById("message");

// Toggle password field when Mode is changed
const modeSelect = form && form.mode; // <select name="mode">
const passwordRow = document.getElementById('passwordRow');
const passwordInput = document.getElementById('passwordInput');

// Tags functionality
const tagInput = document.getElementById('tagInput');
const selectedTagsList = document.getElementById('selectedTags');
const tagSuggestionsMenu = document.getElementById('tagSuggestionsMenu');
let selectedTags = []; // Array of {name, color}
let existingTags = []; // Will be populated from user's links
let highlightedIndex = -1;

const defaultTagColors = ['#0067c5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2'];

function getRandomColor() {
  return defaultTagColors[Math.floor(Math.random() * defaultTagColors.length)];
}

// Fetch existing tags from user's links
async function fetchExistingTags() {
  let userEmail = "anonymous";
  try {
    const authRes = await fetch("/.auth/me");
    const authData = await authRes.json();
    if (authData.clientPrincipal) {
      userEmail = authData.clientPrincipal.userDetails;
    }
  } catch (err) {
    console.warn("Auth check failed:", err);
  }

  if (userEmail === "anonymous") return;

  try {
    const res = await fetch(`/api/myLinks?email=${encodeURIComponent(userEmail)}&type=internal`);
    if (res.ok) {
      const links = await res.json();
      const tagMap = new Map();
      links.forEach(link => {
        if (link.tags && Array.isArray(link.tags)) {
          link.tags.forEach(tag => {
            if (!tagMap.has(tag.name.toLowerCase())) {
              tagMap.set(tag.name.toLowerCase(), tag);
            }
          });
        }
      });
      existingTags = Array.from(tagMap.values());
    }
  } catch (err) {
    console.warn("Failed to fetch existing tags:", err);
  }
}

function renderSelectedTags() {
  selectedTagsList.innerHTML = '';
  selectedTags.forEach((tag, index) => {
    const li = document.createElement('li');
    li.className = 'tag-item';
    li.style.backgroundColor = tag.color;
    li.innerHTML = `
      <input type="color" class="tag-color-picker" value="${tag.color}" data-index="${index}" title="Change tag color">
      <span>${escapeHtml(tag.name)}</span>
      <button type="button" data-index="${index}" title="Remove tag">&times;</button>
    `;
    selectedTagsList.appendChild(li);
  });

  // Add event listeners for color pickers and remove buttons
  selectedTagsList.querySelectorAll('.tag-color-picker').forEach(picker => {
    picker.addEventListener('change', async (e) => {
      const idx = parseInt(e.target.dataset.index);
      const newColor = e.target.value;
      const tagName = selectedTags[idx].name;
      
      // Update the selected tag's color
      selectedTags[idx].color = newColor;
      
      // Also update the color in existingTags so future selections use this color
      const existingTag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (existingTag) {
        existingTag.color = newColor;
        
        // Update all existing links in the database with this tag
        try {
          const authRes = await fetch("/.auth/me");
          const authData = await authRes.json();
          if (authData.clientPrincipal) {
            const userEmail = authData.clientPrincipal.userDetails;
            await fetch('/api/updateTagColor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                tagName: tagName,
                newColor: newColor,
                type: 'internal'
              })
            });
          }
        } catch (err) {
          console.warn('Failed to update tag color in existing links:', err);
        }
      }
      
      renderSelectedTags();
    });
    
    // Live preview on input
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedTags[idx].color = e.target.value;
      e.target.closest('.tag-item').style.backgroundColor = e.target.value;
    });
  });

  selectedTagsList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedTags.splice(idx, 1);
      renderSelectedTags();
    });
  });
}

function escapeHtml(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}

function showSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    tagSuggestionsMenu.hidden = true;
    return;
  }

  const matches = existingTags.filter(tag => 
    tag.name.toLowerCase().includes(q) && 
    !selectedTags.some(st => st.name.toLowerCase() === tag.name.toLowerCase())
  );

  const exactMatch = existingTags.some(t => t.name.toLowerCase() === q) ||
                     selectedTags.some(t => t.name.toLowerCase() === q);

  tagSuggestionsMenu.innerHTML = '';
  highlightedIndex = -1;

  matches.forEach((tag, idx) => {
    const li = document.createElement('li');
    li.dataset.index = idx;
    li.innerHTML = `<span class="tag-preview" style="background:${tag.color}"></span>${highlightMatch(tag.name, q)}`;
    li.addEventListener('click', () => selectTag(tag));
    tagSuggestionsMenu.appendChild(li);
  });

  if (!exactMatch) {
    const li = document.createElement('li');
    li.className = 'tag-suggestion-new';
    li.dataset.index = matches.length;
    li.innerHTML = `+ Add "<strong>${escapeHtml(query.trim())}</strong>" as new tag`;
    li.addEventListener('click', () => addNewTag(query.trim()));
    tagSuggestionsMenu.appendChild(li);
  }

  if (tagSuggestionsMenu.children.length > 0) {
    tagSuggestionsMenu.hidden = false;
    // Position the menu below the input
    const rect = tagInput.getBoundingClientRect();
    tagSuggestionsMenu.style.width = `${rect.width}px`;
  } else {
    tagSuggestionsMenu.hidden = true;
  }
}

function selectTag(tag) {
  if (!selectedTags.some(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
    selectedTags.push({ name: tag.name, color: tag.color });
    renderSelectedTags();
  }
  tagInput.value = '';
  tagSuggestionsMenu.hidden = true;
  tagInput.focus();
}

function addNewTag(name) {
  if (!name.trim()) return;
  if (!selectedTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    // Check if this tag exists in existingTags (case-insensitive) to use its color
    const existingTag = existingTags.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
    const color = existingTag ? existingTag.color : getRandomColor();
    selectedTags.push({ name: name.trim(), color: color });
    renderSelectedTags();
  }
  tagInput.value = '';
  tagSuggestionsMenu.hidden = true;
  tagInput.focus();
}

function navigateSuggestions(direction) {
  const items = tagSuggestionsMenu.querySelectorAll('li');
  if (items.length === 0) return;

  items.forEach(item => item.classList.remove('highlighted'));
  highlightedIndex += direction;

  if (highlightedIndex < 0) highlightedIndex = items.length - 1;
  if (highlightedIndex >= items.length) highlightedIndex = 0;

  items[highlightedIndex].classList.add('highlighted');
  items[highlightedIndex].scrollIntoView({ block: 'nearest' });
}

function selectHighlighted() {
  const items = tagSuggestionsMenu.querySelectorAll('li');
  if (highlightedIndex >= 0 && highlightedIndex < items.length) {
    items[highlightedIndex].click();
  }
}

if (tagInput) {
  tagInput.addEventListener('input', () => showSuggestions(tagInput.value));

  tagInput.addEventListener('keydown', (e) => {
    if (!tagSuggestionsMenu.hidden) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSuggestions(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSuggestions(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0) {
          selectHighlighted();
        } else if (tagInput.value.trim()) {
          addNewTag(tagInput.value);
        }
      } else if (e.key === 'Escape') {
        tagSuggestionsMenu.hidden = true;
      }
    } else if (e.key === 'Enter' && tagInput.value.trim()) {
      e.preventDefault();
      addNewTag(tagInput.value);
    }
  });

  tagInput.addEventListener('blur', () => {
    // Delay hiding to allow click on suggestion
    setTimeout(() => { tagSuggestionsMenu.hidden = true; }, 200);
  });

  tagInput.addEventListener('focus', () => {
    if (tagInput.value.trim()) {
      showSuggestions(tagInput.value);
    }
  });
}

// Initialize - fetch existing tags
fetchExistingTags();

// Conditional Redirect functionality
const conditionalRedirectToggle = document.getElementById('conditionalRedirectToggle');
const conditionalRedirectOptions = document.getElementById('conditionalRedirectOptions');
const desktopToggle = document.getElementById('desktopToggle');
const mobileToggle = document.getElementById('mobileToggle');
const desktopSection = document.getElementById('desktopSection');
const mobileSection = document.getElementById('mobileSection');
const langLocaleList = document.getElementById('langLocaleList');
const addLangLocaleBtn = document.getElementById('addLangLocaleBtn');

// Toggle main conditional redirect section
if (conditionalRedirectToggle) {
  conditionalRedirectToggle.addEventListener('change', () => {
    conditionalRedirectOptions.hidden = !conditionalRedirectToggle.checked;
    // State is preserved - just hide/show without clearing
  });
}

if (desktopToggle) {
  desktopToggle.addEventListener('change', () => {
    desktopSection.hidden = !desktopToggle.checked;
  });
}

if (mobileToggle) {
  mobileToggle.addEventListener('change', () => {
    mobileSection.hidden = !mobileToggle.checked;
  });
}

// Lang-locale management
let langLocaleCounter = 0;

function addLangLocaleEntry(localeData = {}) {
  const locale = localeData.locale || '';
  const mainUrl = localeData.mainUrl || '';
  const desktop = localeData.desktop || {};
  const mobile = localeData.mobile || {};
  const hasDesktop = Object.values(desktop).some(v => v);
  const hasMobile = Object.values(mobile).some(v => v);

  const li = document.createElement('li');
  li.className = 'lang-locale-item';
  li.dataset.id = langLocaleCounter++;
  li.innerHTML = `
    <header>
      <input type="text" placeholder="e.g., en-US, ko-KR" value="${escapeHtml(locale)}" class="lang-locale-code">
      <button type="button" class="remove-lang-locale" title="Remove">Remove</button>
    </header>
    <label>
      Main Target URL (optional)
      <input type="url" placeholder="https://example.com/localized" value="${escapeHtml(mainUrl)}" class="lang-locale-main-url">
    </label>
    <ul class="lang-locale-category-list">
      <li>
        <label class="checkbox-label-inline">
          <input type="checkbox" class="lang-locale-desktop-toggle" ${hasDesktop ? 'checked' : ''}>
          Desktop
        </label>
      </li>
      <li>
        <label class="checkbox-label-inline">
          <input type="checkbox" class="lang-locale-mobile-toggle" ${hasMobile ? 'checked' : ''}>
          Mobile
        </label>
      </li>
    </ul>
    <section class="lang-locale-subsection lang-locale-desktop-section" ${hasDesktop ? '' : 'hidden'}>
      <h5>Desktop</h5>
      <fieldset>
        <label>Windows<input type="url" placeholder="https://example.com/localized/windows" value="${escapeHtml(desktop.windows || '')}" class="lang-locale-windows"></label>
        <label>macOS<input type="url" placeholder="https://example.com/localized/macos" value="${escapeHtml(desktop.macos || '')}" class="lang-locale-macos"></label>
        <label>Linux<input type="url" placeholder="https://example.com/localized/linux" value="${escapeHtml(desktop.linux || '')}" class="lang-locale-linux"></label>
        <label>ChromeOS<input type="url" placeholder="https://example.com/localized/chromeos" value="${escapeHtml(desktop.chromeos || '')}" class="lang-locale-chromeos"></label>
      </fieldset>
    </section>
    <section class="lang-locale-subsection lang-locale-mobile-section" ${hasMobile ? '' : 'hidden'}>
      <h5>Mobile</h5>
      <fieldset>
        <label>Android<input type="url" placeholder="https://example.com/localized/android" value="${escapeHtml(mobile.android || '')}" class="lang-locale-android"></label>
        <label>iOS<input type="url" placeholder="https://example.com/localized/ios" value="${escapeHtml(mobile.ios || '')}" class="lang-locale-ios"></label>
        <label>iPadOS<input type="url" placeholder="https://example.com/localized/ipados" value="${escapeHtml(mobile.ipados || '')}" class="lang-locale-ipados"></label>
      </fieldset>
    </section>
    <p class="lang-locale-error">Please provide at least one URL for this locale.</p>
  `;
  langLocaleList.appendChild(li);

  // Add toggle listeners for Desktop/Mobile sections
  const desktopToggle = li.querySelector('.lang-locale-desktop-toggle');
  const mobileToggle = li.querySelector('.lang-locale-mobile-toggle');
  const desktopSection = li.querySelector('.lang-locale-desktop-section');
  const mobileSection = li.querySelector('.lang-locale-mobile-section');

  desktopToggle.addEventListener('change', () => {
    desktopSection.hidden = !desktopToggle.checked;
  });
  mobileToggle.addEventListener('change', () => {
    mobileSection.hidden = !mobileToggle.checked;
  });

  // Add remove button listener
  li.querySelector('.remove-lang-locale').addEventListener('click', () => {
    li.remove();
  });
}

if (addLangLocaleBtn) {
  addLangLocaleBtn.addEventListener('click', () => {
    addLangLocaleEntry();
  });
}

// Collect conditional redirect data
function getConditionalRedirectData() {
  const data = {
    platformRedirects: {},
    langMap: {}
  };

  // Desktop redirects
  if (desktopToggle && desktopToggle.checked) {
    const windowsUrl = document.getElementById('windowsUrl')?.value.trim();
    const macosUrl = document.getElementById('macosUrl')?.value.trim();
    const linuxUrl = document.getElementById('linuxUrl')?.value.trim();
    const chromeosUrl = document.getElementById('chromeosUrl')?.value.trim();

    if (windowsUrl) data.platformRedirects.windows = windowsUrl;
    if (macosUrl) data.platformRedirects.macos = macosUrl;
    if (linuxUrl) data.platformRedirects.linux = linuxUrl;
    if (chromeosUrl) data.platformRedirects.chromeos = chromeosUrl;
  }

  // Mobile redirects
  if (mobileToggle && mobileToggle.checked) {
    const androidUrl = document.getElementById('androidUrl')?.value.trim();
    const iosUrl = document.getElementById('iosUrl')?.value.trim();
    const ipadosUrl = document.getElementById('ipadosUrl')?.value.trim();

    if (androidUrl) data.platformRedirects.android = androidUrl;
    if (iosUrl) data.platformRedirects.ios = iosUrl;
    if (ipadosUrl) data.platformRedirects.ipados = ipadosUrl;
  }

  // Lang-locale redirects (new nested structure)
  let hasLangLocaleError = false;
  langLocaleList.querySelectorAll('.lang-locale-item').forEach(item => {
    const code = item.querySelector('.lang-locale-code')?.value.trim();
    
    // Lang-locale code is required for each entry
    if (!code) {
      item.classList.add('has-error');
      hasLangLocaleError = true;
      return;
    }

    const mainUrl = item.querySelector('.lang-locale-main-url')?.value.trim();
    const windowsUrl = item.querySelector('.lang-locale-windows')?.value.trim();
    const macosUrl = item.querySelector('.lang-locale-macos')?.value.trim();
    const linuxUrl = item.querySelector('.lang-locale-linux')?.value.trim();
    const chromeosUrl = item.querySelector('.lang-locale-chromeos')?.value.trim();
    const androidUrl = item.querySelector('.lang-locale-android')?.value.trim();
    const iosUrl = item.querySelector('.lang-locale-ios')?.value.trim();
    const ipadosUrl = item.querySelector('.lang-locale-ipados')?.value.trim();

    // Check if at least one URL is provided
    const hasAnyUrl = mainUrl || windowsUrl || macosUrl || linuxUrl || chromeosUrl || androidUrl || iosUrl || ipadosUrl;
    if (!hasAnyUrl) {
      item.classList.add('has-error');
      hasLangLocaleError = true;
      return;
    }
    item.classList.remove('has-error');

    // Build locale entry
    const localeEntry = {};
    if (mainUrl) localeEntry.main = mainUrl;
    if (windowsUrl) localeEntry.windows = windowsUrl;
    if (macosUrl) localeEntry.macos = macosUrl;
    if (linuxUrl) localeEntry.linux = linuxUrl;
    if (chromeosUrl) localeEntry.chromeos = chromeosUrl;
    if (androidUrl) localeEntry.android = androidUrl;
    if (iosUrl) localeEntry.ios = iosUrl;
    if (ipadosUrl) localeEntry.ipados = ipadosUrl;

    data.langMap[code] = localeEntry;
  });

  data.hasLangLocaleError = hasLangLocaleError;
  return data;
}

function togglePasswordRow() {
  if (!modeSelect) return;
  if (modeSelect.value === 'protected') {
    passwordRow.style.display = '';
    passwordInput.required = true;
  } else {
    passwordRow.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
  }
}

// initialize visibility on load
togglePasswordRow();
modeSelect && modeSelect.addEventListener('change', togglePasswordRow);

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Date validation
    const formData = new FormData(form);
    const start = formData.get("startDate");
    const end = formData.get("expiryDate");
    
    if (start && end && new Date(end) <= new Date(start)) {
        alert("Expiry date must be later than the start date.");
        return;
    }

    const submitBtn = e.submitter || form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    msg.textContent = "Checking...";

    const data = Object.fromEntries(new FormData(form).entries());
    data.isCaseSensitive = form.isCaseSensitive.checked;
    data.type = "internal";
    data.origin = window.location.origin; // Tell backend which domain we're on

    // Add tags to the data
    if (selectedTags.length > 0) {
      data.tags = selectedTags;
    }

    // Add conditional redirect data
    if (conditionalRedirectToggle && conditionalRedirectToggle.checked) {
      const conditionalData = getConditionalRedirectData();
      
      // Check for validation errors in lang-locale entries
      if (conditionalData.hasLangLocaleError) {
        alert('Please provide a lang-locale code and at least one URL for each lang-locale entry, or remove empty entries.');
        if (submitBtn) submitBtn.disabled = false;
        msg.textContent = '';
        return;
      }
      
      if (Object.keys(conditionalData.platformRedirects).length > 0) {
        data.platformRedirects = conditionalData.platformRedirects;
      }
      if (Object.keys(conditionalData.langMap).length > 0) {
        data.langMap = conditionalData.langMap;
      }
    }

    // 1. Get user identity
    let userEmail = "anonymous";
    try {
        const authRes = await fetch("/.auth/me");
        const authData = await authRes.json();
        if (authData.clientPrincipal) {
            userEmail = authData.clientPrincipal.userDetails;
        }
    } catch (err) {
        console.warn("Auth check failed:", err);
    }
    data.createdBy = userEmail;

    // 2. Check for duplicate Target URLs for this user
    try {
        const checkRes = await fetch("/api/checkExistingTargetURL", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                targetUrl: data.targetUrl,
                createdBy: userEmail,
                type: "internal"
            })
        });

        if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.exists) {
                const confirmMsg = `Target URL already exists under slug(s): ${checkData.slugs.join(", ")}\nDo you want to create an additional slug?`;
                if (!confirm(confirmMsg)) {
                    if (submitBtn) submitBtn.disabled = false;
                    msg.textContent = "";
                    return;
                }
            }
        }
    } catch (err) {
        console.warn("Duplicate check failed, proceeding:", err);
    }

    msg.textContent = "Creating...";

    const res = await fetch("/api/createLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    let result = null;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        try { result = JSON.parse(text); } catch { result = { error: text || `HTTP ${res.status}` }; }
      }
    } catch (err) {
      result = { error: "Invalid server response" };
    }

    if (res.ok) {
      const url = result && (result.fullUrl || result.url || result.slug) ? (result.fullUrl || result.url || result.slug) : 'created';
      msg.textContent = `Success! URL: ${url}`;
    } else {
      alert(`Error: ${result && result.error ? result.error : 'Server error'}`);
      msg.textContent = `Error: ${result && result.error ? result.error : 'Server error'}`;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
