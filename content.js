// Hoverscope content script
// Detects telescope/satellite names and displays hover tooltips

let telescopeData = {};
let tooltip = null;
let userLanguage = 'en';

// Field label translations
const FIELD_TRANSLATIONS = {
  en: {}, // English - no translation needed, use default
  de: {
    type: 'Typ',
    wavelengths: 'Wellenlängen',
    location: 'Standort',
    status: 'Status',
    launch_year: 'Startjahr',
    decommission_year: 'Stilllegungsjahr',
    diameter: 'Durchmesser',
    altitude: 'Höhe',
    volume: 'Volumen',
    mass_resolution: 'Massenauflösung',
    end_redshift: 'Endrotverschiebung',
    merger_tree_code: 'Merger-Tree-Code',
    parent_simulation: 'Übergeordnete Simulation',
    included_physics: 'Enthaltene Physik'
  },
  es: {
    type: 'Tipo',
    wavelengths: 'Longitudes de onda',
    location: 'Ubicación',
    status: 'Estado',
    launch_year: 'Año de lanzamiento',
    decommission_year: 'Año de desmantelamiento',
    diameter: 'Diámetro',
    altitude: 'Altitud',
    volume: 'Volumen',
    mass_resolution: 'Resolución de masa',
    end_redshift: 'Corrimiento al rojo final',
    merger_tree_code: 'Código de árbol de fusión',
    parent_simulation: 'Simulación principal',
    included_physics: 'Física incluida'
  },
  fr: {
    type: 'Type',
    wavelengths: 'Longueurs d\'onde',
    location: 'Emplacement',
    status: 'Statut',
    launch_year: 'Année de lancement',
    decommission_year: 'Année de déclassement',
    diameter: 'Diamètre',
    altitude: 'Altitude',
    volume: 'Volume',
    mass_resolution: 'Résolution de masse',
    end_redshift: 'Décalage vers le rouge final',
    merger_tree_code: 'Code d\'arbre de fusion',
    parent_simulation: 'Simulation parente',
    included_physics: 'Physique incluse'
  },
  it: {
    type: 'Tipo',
    wavelengths: 'Lunghezze d\'onda',
    location: 'Posizione',
    status: 'Stato',
    launch_year: 'Anno di lancio',
    decommission_year: 'Anno di dismissione',
    diameter: 'Diametro',
    altitude: 'Altitudine',
    volume: 'Volume',
    mass_resolution: 'Risoluzione di massa',
    end_redshift: 'Redshift finale',
    merger_tree_code: 'Codice albero di fusione',
    parent_simulation: 'Simulazione genitore',
    included_physics: 'Fisica inclusa'
  },
  zh: {
    type: '类型',
    wavelengths: '波长',
    location: '位置',
    status: '状态',
    launch_year: '发射年份',
    decommission_year: '退役年份',
    diameter: '直径',
    altitude: '高度',
    volume: '体积',
    mass_resolution: '质量分辨率',
    end_redshift: '最终红移',
    merger_tree_code: '合并树代码',
    parent_simulation: '父模拟',
    included_physics: '包含的物理'
  }
};

// Detect user language
function detectLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0]; // e.g., 'en-US' → 'en'

  // Check if we have translations for this language
  if (FIELD_TRANSLATIONS[langCode]) {
    return langCode;
  }
  return 'en'; // Default to English
}

// Translate field name to user's language
function translateFieldLabel(fieldName) {
  const translations = FIELD_TRANSLATIONS[userLanguage];
  if (translations && translations[fieldName]) {
    return translations[fieldName];
  }

  // Fallback: convert field_name to "Field Name"
  return fieldName.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

// Initialize
async function init() {
  console.log('Hoverscope: Initializing...');

  // Detect language
  userLanguage = detectLanguage();
  console.log(`Hoverscope: User language detected as '${userLanguage}'`);

  // Get telescope data from background script
  try {
    telescopeData = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getTelescopeData' }, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(data || {});
      });
    });
  } catch (error) {
    console.error('Hoverscope: Error fetching telescope data from background:', error);
    return;
  }

  if (Object.keys(telescopeData).length === 0) {
    console.warn('Hoverscope: No telescope data available. Try reloading the extension.');
    return;
  }

  console.log(`Hoverscope: Loaded ${Object.keys(telescopeData).length} telescopes/satellites`);

  // Create tooltip element
  createTooltip();

  // Find and wrap telescope names
  processPage();

  console.log('Hoverscope: Initialization complete');
}

function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'hoverscope-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
}

function processPage() {
  // Target areas: titles, abstracts, and main content on arXiv and other sites
  const selectors = [
    'td.arxiv_item', // For astrochristian.github.io - contains full paper entry
    '.arxiv_item',
    '.title',
    '.abstract',
    'blockquote.abstract',
    'h1.title',
    '.ltx_abstract',
    '.article-title',
    'article',
    'main',
    '.paper',
    '.paper-title',
    '.paper-abstract',
    '.paper-entry',
    '.paper-item',
    '.paper-list',
    '.paper-details',
    '.content',
    '#content',
    '.main-content',
    '[class*="paper"]',  // Match any class containing "paper"
    '[class*="abstract"]' // Match any class containing "abstract"
  ];

  // If no specific selectors match, fall back to body
  let targets = [];
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!el.closest('#hoverscope-tooltip')) {
        targets.push(el);
      }
    });
  });

  // Fallback: if we found nothing, process the entire body
  if (targets.length === 0) {
    console.log('Hoverscope: No specific selectors matched, falling back to document.body');
    targets = [document.body];
  }
  
  console.log(`Hoverscope: Found ${targets.length} elements to process`);
  
  if (targets.length === 0) {
    console.warn('Hoverscope: No target elements found on page. Are you on an arXiv paper page?');
  }
  
  // Process each target element
  let totalMatches = 0;
  let elementIndex = 0;
  targets.forEach(element => {
    if (element.getAttribute('data-hoverscope-processed')) return;
    totalMatches += processElement(element, elementIndex);
    element.setAttribute('data-hoverscope-processed', 'true');
    elementIndex++;
  });

  console.log(`Hoverscope: Found and marked ${totalMatches} telescope/survey/simulation/SAM mentions`);
}

function processElement(element, elementIndex) {
  // Get all text nodes
  const textNodes = getTextNodes(element);
  let telescopeCount = 0;

  textNodes.forEach(node => {
    const text = node.textContent;
    let modified = false;
    const fragments = [];
    let lastIndex = 0;
    const matches = [];
    
    // Find all matches first - telescopes
    Object.keys(telescopeData).forEach(key => {
      const telescope = telescopeData[key];
      const names = [telescope.name, ...(telescope.aliases || [])];

      names.filter(name => name).forEach(name => {
        // For certain telescopes, use case-sensitive matching to avoid false positives
        // ET: avoid "et al."
        // FIRST/FAST: avoid common words "first" and "fast"
        // INTEGRAL: avoid lowercase "integral" (as in "integral part")
        const caseSensitiveNames = ['ET', 'FIRST', 'FAST', 'INTEGRAL'];
        const flags = caseSensitiveNames.includes(name) ? 'g' : 'gi';

        // Build regex pattern with special cases
        let pattern;

        // Hubble: avoid "Hubble constant", "Hubble parameter", "Hubble tension", "Hubble expansion", "Hubble flow", "Hubble residuals", "Hubble Frontier Fields", "Hubble-Lemaître", "Hubble diagram"
        if (name === 'Hubble' || name === 'Hubble Space Telescope' || name === 'HST') {
          // Negative lookahead to exclude matches followed by these terms (case-insensitive)
          // Also exclude hyphenated forms like "Hubble-Lemaître"
          pattern = `\\b${escapeRegex(name)}\\b(?![-–](?:Lem[aî]tre)|\\s+(?:constant|parameter|tension|expansion|flow|residuals|diagram|Frontier\\s+Fields))`;
        }
        // Planck: avoid hyphenated cases like "Fokker-Planck" or "Fokker--Planck"
        else if (name === 'Planck' || name === 'Planck satellite') {
          // Negative lookbehind to exclude matches preceded by one or two hyphens
          pattern = `(?<!-{1,2})\\b${escapeRegex(name)}\\b`;
        }
        // Fermi: avoid hyphenated cases like "Fermi-Hubbard" or "Fermi--Hubbard"
        else if (name === 'Fermi' || name === 'Fermi Gamma-ray Space Telescope') {
          // Negative lookahead to exclude matches followed by hyphen(s) and "Hubbard"
          pattern = `\\b${escapeRegex(name)}\\b(?![-–]{1,2}Hubbard)`;
        }
        // COSMOS: avoid "COSMOS-Web"
        else if (name === 'COSMOS') {
          // Negative lookahead to exclude matches followed by "-Web"
          pattern = `\\b${escapeRegex(name)}\\b(?!-Web)`;
        }
        else {
          pattern = `\\b${escapeRegex(name)}\\b`;
        }

        const regex = new RegExp(pattern, flags);
        let match;

        // Reset regex
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            key: key,
            type: 'telescope'
          });
        }
      });
    });

    if (matches.length === 0) {
      return;
    }
    
    // Sort matches by position and remove overlaps
    matches.sort((a, b) => a.start - b.start);
    const uniqueMatches = [];
    let lastEnd = -1;
    
    matches.forEach(match => {
      if (match.start >= lastEnd) {
        uniqueMatches.push(match);
        lastEnd = match.end;
        telescopeCount++;
      }
    });
    
    // Build the replacement nodes
    const fragment = document.createDocumentFragment();
    lastIndex = 0;
    
    uniqueMatches.forEach(match => {
      // Add text before match
      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)));
      }

      // Add matched text as span
      const span = document.createElement('span');
      span.className = 'hoverscope-term';
      span.setAttribute('data-telescope-key', match.key);
      span.textContent = match.text;

      // Add event listeners for telescopes (tooltip)
      span.addEventListener('mouseenter', handleMouseEnter);
      span.addEventListener('mouseleave', handleMouseLeave);
      span.addEventListener('mousemove', handleMouseMove);

      fragment.appendChild(span);
      lastIndex = match.end;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the text node with our fragment
    node.parentNode.replaceChild(fragment, node);
  });

  return telescopeCount;
}

function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip if already processed or inside script/style
        if (node.parentElement.closest('.hoverscope-term, script, style, #hoverscope-tooltip')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip if inside form fields or editable elements
        if (node.parentElement.closest('input, textarea, select, [contenteditable="true"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip if inside author fields (deprecated behavior)
        if (node.parentElement.closest('.authors, .paper-authors, [class*="author"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Only include nodes with actual text
        if (node.textContent.trim().length > 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function handleMouseEnter(event) {
  const term = event.target;
  const key = term.getAttribute('data-telescope-key');
  const data = telescopeData[key];

  if (!data) return;

  // Clear previous content
  tooltip.textContent = '';

  // Build tooltip content safely using DOM methods
  const nameDiv = document.createElement('div');
  nameDiv.className = 'hoverscope-name';
  nameDiv.textContent = data.name;
  tooltip.appendChild(nameDiv);

  // Use a Set to track fields that have been processed
  const processedFields = new Set(['name', 'aliases', 'description', 'order_key']);

  // Get the specific display order, or an empty array if none
  const orderKey = data.order_key;
  const specificDisplayOrder = (telescopeData._display_orders && orderKey && telescopeData._display_orders[orderKey]) 
    ? telescopeData._display_orders[orderKey] 
    : [];

  // Helper function to create and append a field
  const appendField = (field, value) => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'hoverscope-field';

    const fieldLabel = document.createElement('strong');
    const labelText = translateFieldLabel(field);
    fieldLabel.textContent = `${labelText}: `;

    fieldDiv.appendChild(fieldLabel);
    // Convert value to string and trim, handling arrays and objects
    const valueStr = typeof value === 'string' ? value : String(value);
    fieldDiv.appendChild(document.createTextNode(valueStr.trim()));
    tooltip.appendChild(fieldDiv);
    processedFields.add(field);
  };

  // 1. Add fields in the specified order
  specificDisplayOrder.forEach(field => {
    if (data[field]) {
      appendField(field, data[field]);
    }
  });

  // 2. Add any remaining fields not in the specific order
  Object.keys(data).forEach(field => {
    if (!processedFields.has(field) && data[field]) {
      appendField(field, data[field]);
    }
  });

  if (data.description) {
    const descDiv = document.createElement('div');
    descDiv.className = 'hoverscope-description';
    descDiv.textContent = data.description;
    tooltip.appendChild(descDiv);
  }

  tooltip.style.display = 'block';

  // Position tooltip
  positionTooltip(event);
}

function handleMouseLeave(event) {
  tooltip.style.display = 'none';
}

function handleMouseMove(event) {
  positionTooltip(event);
}

function positionTooltip(event) {
  const offset = 15;
  let x = event.pageX + offset;
  let y = event.pageY + offset;

  // Get tooltip dimensions
  const tooltipRect = tooltip.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;

  // Prevent tooltip from going off screen
  if (x + tooltipWidth > window.innerWidth + window.scrollX) {
    x = event.pageX - tooltipWidth - offset;
  }

  if (y + tooltipHeight > window.innerHeight + window.scrollY) {
    y = event.pageY - tooltipHeight - offset;
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

// Run when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-process after all resources load (images, scripts, etc.) to catch late-loading content
window.addEventListener('load', () => {
  console.log('Hoverscope: Window loaded, re-processing page');
  processPage();
});

// Also process dynamically loaded content (for single-page apps and revealed content)
const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;

  mutations.forEach((mutation) => {
    // Process when new nodes are added
    if (mutation.addedNodes.length) {
      shouldProcess = true;
    }

    // Also process when attributes change (e.g., class changes that reveal hidden content)
    if (mutation.type === 'attributes') {
      // Check if the element or its children might contain text we need to process
      const target = mutation.target;
      if (target.nodeType === Node.ELEMENT_NODE &&
          (target.textContent.trim().length > 0 || target.querySelector('*[class*="abstract"], *[class*="paper"]'))) {
        shouldProcess = true;
      }
    }
  });

  if (shouldProcess) {
    processPage();
  }
});

// Start observing immediately to catch dynamic content
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'hidden'] // Watch for class/style/hidden changes
});
