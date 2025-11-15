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
    console.error('Hoverscope: Error fetching data from background:', error);
    return;
  }
  
  if (Object.keys(telescopeData).length === 0) {
    console.warn('Hoverscope: No telescope data available. Try reloading the extension.');
    return;
  }
  
  console.log(`Hoverscope: Loaded ${Object.keys(telescopeData).length} telescopes/satellites`);
  console.log('Hoverscope: Sample telescopes:', Object.keys(telescopeData).slice(0, 5).join(', '));
  
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
  // Target areas: titles, abstracts, and main content on arXiv
  const selectors = [
    '.title',
    '.abstract',
    '.authors',
    'blockquote.abstract',
    'h1.title',
    '.ltx_abstract',
    '.article-title',
    'article',
    'main'
  ];
  
  const targets = [];
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!el.closest('#hoverscope-tooltip')) {
        targets.push(el);
      }
    });
  });
  
  console.log(`Hoverscope: Found ${targets.length} elements to process`);
  
  if (targets.length === 0) {
    console.warn('Hoverscope: No target elements found on page. Are you on an arXiv paper page?');
  }
  
  // Process each target element
  let totalMatches = 0;
  targets.forEach(element => {
    if (element.getAttribute('data-hoverscope-processed')) return;
    const matches = processElement(element);
    totalMatches += matches;
    element.setAttribute('data-hoverscope-processed', 'true');
  });
  
  console.log(`Hoverscope: Found and marked ${totalMatches} telescope mentions`);
}

function processElement(element) {
  // Get all text nodes
  const textNodes = getTextNodes(element);
  let matchCount = 0;
  
  textNodes.forEach(node => {
    const text = node.textContent;
    let modified = false;
    const fragments = [];
    let lastIndex = 0;
    const matches = [];
    
    // Find all matches first
    Object.keys(telescopeData).forEach(key => {
      const telescope = telescopeData[key];
      const names = [telescope.name, ...(telescope.aliases || [])];
      
      names.forEach(name => {
        // Create case-insensitive regex with word boundaries
        const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
        let match;
        
        // Reset regex
        regex.lastIndex = 0;
        
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            key: key
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
        matchCount++;
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
      
      // Add event listeners
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
  
  return matchCount;
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

  if (data.type) {
    const typeDiv = document.createElement('div');
    typeDiv.className = 'hoverscope-field';
    const typeLabel = document.createElement('strong');
    typeLabel.textContent = 'Type: ';
    typeDiv.appendChild(typeLabel);
    typeDiv.appendChild(document.createTextNode(data.type));
    tooltip.appendChild(typeDiv);
  }

  if (data.launch_date) {
    const launchDiv = document.createElement('div');
    launchDiv.className = 'hoverscope-field';
    const launchLabel = document.createElement('strong');
    launchLabel.textContent = 'Launch: ';
    launchDiv.appendChild(launchLabel);
    launchDiv.appendChild(document.createTextNode(data.launch_date));
    tooltip.appendChild(launchDiv);
  }

  if (data.wavelengths) {
    const wavelengthsDiv = document.createElement('div');
    wavelengthsDiv.className = 'hoverscope-field';
    const wavelengthsLabel = document.createElement('strong');
    wavelengthsLabel.textContent = 'Wavelengths: ';
    wavelengthsDiv.appendChild(wavelengthsLabel);
    wavelengthsDiv.appendChild(document.createTextNode(data.wavelengths));
    tooltip.appendChild(wavelengthsDiv);
  }

  if (data.survey_area) {
    const surveyDiv = document.createElement('div');
    surveyDiv.className = 'hoverscope-field';
    const surveyLabel = document.createElement('strong');
    surveyLabel.textContent = 'Survey Area: ';
    surveyDiv.appendChild(surveyLabel);
    surveyDiv.appendChild(document.createTextNode(data.survey_area));
    tooltip.appendChild(surveyDiv);
  }

  if (data.location) {
    const locationDiv = document.createElement('div');
    locationDiv.className = 'hoverscope-field';
    const locationLabel = document.createElement('strong');
    locationLabel.textContent = 'Location: ';
    locationDiv.appendChild(locationLabel);
    locationDiv.appendChild(document.createTextNode(data.location));
    tooltip.appendChild(locationDiv);
  }

  if (data.status) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'hoverscope-field';
    const statusLabel = document.createElement('strong');
    statusLabel.textContent = 'Status: ';
    statusDiv.appendChild(statusLabel);
    statusDiv.appendChild(document.createTextNode(data.status));
    tooltip.appendChild(statusDiv);
  }

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

// Also process dynamically loaded content (for single-page apps)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      processPage();
    }
  });
});

// Start observing after initial load
setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}, 1000);
