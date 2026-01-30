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
    picker.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      selectedTags[idx].color = e.target.value;
      renderSelectedTags();
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
    selectedTags.push({ name: name.trim(), color: getRandomColor() });
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
