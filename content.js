// Hoverscope content script
// Detects telescope/satellite names and displays hover tooltips

let telescopeData = {};
let tooltip = null;

// Initialize
async function init() {
  console.log('Hoverscope: Initializing...');

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
    '.authors',
    'blockquote.abstract',
    'h1.title',
    '.ltx_abstract',
    '.article-title',
    'article',
    'main',
    '.paper',
    '.paper-title',
    '.paper-abstract',
    '.paper-authors',
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

        // Hubble: avoid "Hubble parameter", "Hubble tension", "Hubble expansion", "Hubble flow", "Hubble residuals", "Hubble Frontier Fields"
        if (name === 'Hubble' || name === 'Hubble Space Telescope' || name === 'HST') {
          // Negative lookahead to exclude matches followed by these terms (case-insensitive)
          pattern = `\\b${escapeRegex(name)}\\b(?!\\s+(?:parameter|tension|expansion|flow|residuals|Frontier\\s+Fields))`;
        }
        // Planck: avoid hyphenated cases like "Fokker-Planck" or "Fokker--Planck"
        else if (name === 'Planck' || name === 'Planck satellite') {
          // Negative lookbehind to exclude matches preceded by one or two hyphens
          pattern = `(?<!-{1,2})\\b${escapeRegex(name)}\\b`;
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
    const labelText = field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
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

// Start observing after initial load
setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'] // Watch for class/style/hidden changes
  });
}, 1000);
