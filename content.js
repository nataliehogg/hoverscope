// Hoverscope content script
// Detects telescope/satellite names and displays hover tooltips
// Detects Handley Lab member names and displays confetti

let telescopeData = {};
let namesData = {};
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

  // Get names data from background script
  try {
    namesData = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getNamesData' }, (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(data || {});
      });
    });
  } catch (error) {
    console.error('Hoverscope: Error fetching names data from background:', error);
    // Continue even if names data fails
  }

  if (Object.keys(telescopeData).length === 0) {
    console.warn('Hoverscope: No telescope data available. Try reloading the extension.');
    return;
  }

  console.log(`Hoverscope: Loaded ${Object.keys(telescopeData).length} telescopes/satellites`);
  console.log(`Hoverscope: Loaded ${Object.keys(namesData).length} names`);

  // Create tooltip element
  createTooltip();

  // Find and wrap telescope names and people names
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
  let totalTelescopeMatches = 0;
  let totalNameMatches = 0;
  let elementIndex = 0;
  targets.forEach(element => {
    if (element.getAttribute('data-hoverscope-processed')) return;
    const result = processElement(element, elementIndex);
    totalMatches += result.total;
    totalTelescopeMatches += result.telescopes;
    totalNameMatches += result.names;
    element.setAttribute('data-hoverscope-processed', 'true');
    elementIndex++;
  });

  console.log(`Hoverscope: Found and marked ${totalTelescopeMatches} telescope/survey/simulation/SAM mentions and ${totalNameMatches} name mentions`);
}

function processElement(element, elementIndex) {
  // Get all text nodes
  const textNodes = getTextNodes(element);
  let telescopeCount = 0;
  let nameCount = 0;

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

        // Hubble: avoid "Hubble tension"
        if (name === 'Hubble' || name === 'Hubble Space Telescope' || name === 'HST') {
          // Negative lookahead to exclude matches followed by "tension"
          pattern = `\\b${escapeRegex(name)}\\b(?!\\s+tension)`;
        }
        // Planck: avoid hyphenated cases like "Fokker-Planck" or "Fokker--Planck"
        else if (name === 'Planck' || name === 'Planck satellite') {
          // Negative lookbehind to exclude matches preceded by one or two hyphens
          pattern = `(?<!-{1,2})\\b${escapeRegex(name)}\\b`;
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

    // Find all matches - names
    const nameMatchCountBefore = matches.filter(m => m.type === 'name').length;

    Object.keys(namesData).forEach(key => {
      const person = namesData[key];
      const names = [person.name, ...(person.aliases || [])];

      names.filter(name => name).forEach(name => {

        // Try regular format: "FirstName LastName" or "Initials LastName"
        const regex = new RegExp(`\\b${escapeRegex(name).replace(/\s+/g, '\\s+')}\\b`, 'gi');
        let match;

        // Reset regex
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            key: key,
            type: 'name'
          });
        }

        // Also try reversed format: "LastName, Initials" (common on arXiv)
        const nameParts = name.trim().split(/\s+/); // Use regex split to handle multiple spaces
        if (nameParts.length >= 2) {
          // For "Will Handley" -> try "Handley, W."
          // For "W. Handley" -> try "Handley, W."
          // For "N. B. Hogg" -> try "Hogg, N. B."
          const lastName = nameParts[nameParts.length - 1];
          const firstParts = nameParts.slice(0, -1).join(' ');

          // Create reversed pattern with flexible whitespace
          const reversedName = `${escapeRegex(lastName)},\\s*${escapeRegex(firstParts).replace(/\s+/g, '\\s+')}`;
          const reversedRegex = new RegExp(`\\b${reversedName}\\b`, 'gi');
          reversedRegex.lastIndex = 0;

          while ((match = reversedRegex.exec(text)) !== null) {
            matches.push({
              start: match.index,
              end: match.index + match[0].length,
              text: match[0],
              key: key,
              type: 'name'
            });
          }
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
        if (match.type === 'telescope') {
          telescopeCount++;
        } else if (match.type === 'name') {
          nameCount++;
        }
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
      if (match.type === 'telescope') {
        span.className = 'hoverscope-term';
        span.setAttribute('data-telescope-key', match.key);
        span.textContent = match.text;

        // Add event listeners for telescopes (tooltip)
        span.addEventListener('mouseenter', handleMouseEnter);
        span.addEventListener('mouseleave', handleMouseLeave);
        span.addEventListener('mousemove', handleMouseMove);
      } else if (match.type === 'name') {
        span.className = 'hoverscope-person';
        span.setAttribute('data-name-key', match.key);
        span.textContent = match.text;

        // Add event listeners for names (confetti)
        span.addEventListener('mouseenter', handleNameMouseEnter);
        span.addEventListener('mouseleave', handleNameMouseLeave);
      }

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

  return {
    total: telescopeCount + nameCount,
    telescopes: telescopeCount,
    names: nameCount
  };
}

function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip if already processed or inside script/style
        if (node.parentElement.closest('.hoverscope-term, .hoverscope-person, script, style, #hoverscope-tooltip')) {
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

// Name hover handlers - trigger confetti
function handleNameMouseEnter(event) {
  const rect = event.target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  createConfetti(centerX, centerY);
}

function handleNameMouseLeave(event) {
  // Nothing needed on leave
}

// Confetti animation
function createConfetti(x, y) {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e'];
  const particleCount = 25;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'hoverscope-confetti';

    // Random color
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Random size between 4 and 8px
    const size = Math.random() * 4 + 4;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';

    // Starting position (at the name)
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';

    // Random direction and distance (increased velocity for wider spread)
    const angle = (Math.random() * Math.PI * 2);
    const velocity = Math.random() * 80 + 60; // Increased from 50+30 to 80+60
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    // Random rotation
    const rotation = Math.random() * 360;

    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    particle.style.setProperty('--rotation', rotation + 'deg');

    document.body.appendChild(particle);

    // Remove particle after animation (increased from 800ms to 1400ms)
    setTimeout(() => {
      particle.remove();
    }, 1400);
  }
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
