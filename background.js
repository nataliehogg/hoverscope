// Background service worker for Hoverscope
// Loads telescope, survey, simulation, and SAM databases and combines them

const GITHUB_BASE_URL =
  "https://raw.githubusercontent.com/nataliehogg/hoverscope/main/";

// Detect user language
function detectLanguage() {
  const browserLang = chrome.i18n.getUILanguage();
  const langCode = browserLang.split('-')[0]; // e.g., 'en-US' → 'en'

  // Supported languages
  const supportedLanguages = ['de', 'es', 'fr', 'it', 'zh'];

  if (supportedLanguages.includes(langCode)) {
    return langCode;
  }
  return 'en'; // Default to English
}

// Get filename with language suffix
function getLocalizedFilename(baseFilename, language) {
  if (language === 'en') {
    return baseFilename;
  }
  const [name, ext] = baseFilename.split('.');
  return `${name}.${language}.${ext}`;
}

// Load bundled data on installation - this is the PRIMARY data source
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Hoverscope installed, loading databases...");
  await loadBundledData();

  // Only fetch updates from GitHub in production (not in developer mode)
  const isDevMode = !chrome.runtime.getManifest().update_url;
  if (!isDevMode) {
    await tryUpdateFromGitHub();
  } else {
    console.log("Hoverscope: Developer mode detected, skipping GitHub updates");
  }
});

// Load and combine all bundled database files
async function loadBundledData() {
  try {
    const language = detectLanguage();
    console.log(`Hoverscope: Loading data for language: ${language}`);

    // Get localized filenames
    const telescopesFile = getLocalizedFilename("telescopes.json", language);
    const surveysFile = getLocalizedFilename("surveys.json", language);
    const simulationsFile = getLocalizedFilename("simulations.json", language);
    const samsFile = getLocalizedFilename("sams.json", language);
    const samplersFile = getLocalizedFilename("samplers.json", language);

    // Load all database files in parallel, with fallback to English
    const loadWithFallback = async (filename, fallbackFilename) => {
      try {
        const response = await fetch(chrome.runtime.getURL(filename));
        if (!response.ok) throw new Error(`${filename} not found`);
        return await response.json();
      } catch (error) {
        console.log(`Hoverscope: ${filename} not found, using ${fallbackFilename}`);
        const response = await fetch(chrome.runtime.getURL(fallbackFilename));
        return await response.json();
      }
    };

    const [telescopes, surveys, simulations, sams, samplers] = await Promise.all([
      loadWithFallback(telescopesFile, "telescopes.json"),
      loadWithFallback(surveysFile, "surveys.json"),
      loadWithFallback(simulationsFile, "simulations.json"),
      loadWithFallback(samsFile, "sams.json"),
      loadWithFallback(samplersFile, "samplers.json"),
    ]);

    // Combine databases
    const combinedData = combineDataSources(
      telescopes,
      surveys,
      simulations,
      sams,
      samplers,
    );

    await chrome.storage.local.set({
      telescopeData: combinedData,
      lastUpdate: Date.now(),
      dataSource: "bundled",
    });

    console.log(
      "Hoverscope: Loaded",
      Object.keys(combinedData).length - 1,
      "entries from bundled databases (telescopes, surveys, simulations, SAMs, samplers)",
    );
  } catch (error) {
    console.error("Hoverscope: Error loading bundled data:", error);
  }
}

// Combine multiple data sources into a single database
function combineDataSources(telescopes, surveys, simulations, sams, samplers) {
  // Create the combined _display_orders object
  const displayOrders = {
    telescope:
      telescopes.display_order ||
      surveys.display_order || [
        "type",
        "launch_date",
        "wavelengths",
        "survey_area",
        "location",
        "status",
      ],
    simulation:
      simulations.display_order || [
        "type",
        "volume",
        "mass_resolution",
        "code",
        "included_physics",
        "hydrodynamics",
        "subgrid_model",
      ],
    SAM:
      sams.display_order || [
        "type",
        "included_physics",
        "volume",
        "mass_resolution",
        "end_redshift",
        "merger_tree_code",
        "parent_simulation",
      ],
    sampler:
      samplers.display_order || [
        "type",
        "method",
        "language",
        "parallelisable",
      ],
  };

  // Combine all entries, excluding display_order fields
  const combined = { _display_orders: displayOrders };

  // Helper to add entries from a source, excluding display_order, and adding order_key
  const addEntries = (source, orderKey) => {
    Object.keys(source).forEach((key) => {
      if (key !== "display_order") {
        combined[key] = {
          ...source[key],
          order_key: orderKey,
        };
      }
    });
  };

  addEntries(telescopes, "telescope");
  addEntries(surveys, "telescope");
  addEntries(simulations, "simulation");
  addEntries(sams, "SAM");
  addEntries(samplers, "sampler");

  return combined;
}

// Try to update from GitHub (optional - only if you've set up a GitHub repo)
async function tryUpdateFromGitHub() {
  try {
    // Load all database files from GitHub in parallel
    const [telescopes, surveys, simulations, sams, samplers] = await Promise.all([
      fetch(GITHUB_BASE_URL + "telescopes.json").then((r) => {
        if (!r.ok) throw new Error("telescopes.json fetch failed");
        return r.json();
      }),
      fetch(GITHUB_BASE_URL + "surveys.json").then((r) => {
        if (!r.ok) throw new Error("surveys.json fetch failed");
        return r.json();
      }),
      fetch(GITHUB_BASE_URL + "simulations.json").then((r) => {
        if (!r.ok) throw new Error("simulations.json fetch failed");
        return r.json();
      }),
      fetch(GITHUB_BASE_URL + "sams.json").then((r) => {
        if (!r.ok) throw new Error("sams.json fetch failed");
        return r.json();
      }),
      fetch(GITHUB_BASE_URL + "samplers.json").then((r) => {
        if (!r.ok) throw new Error("samplers.json fetch failed");
        return r.json();
      }),
    ]);

    // Combine databases
    const combinedData = combineDataSources(
      telescopes,
      surveys,
      simulations,
      sams,
      samplers,
    );

    await chrome.storage.local.set({
      telescopeData: combinedData,
      lastUpdate: Date.now(),
      dataSource: "github",
    });

    console.log("Hoverscope: Updated database from GitHub");
  } catch (error) {
    console.log(
      "Hoverscope: Could not fetch from GitHub, using bundled data",
      error.message,
    );
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTelescopeData") {
    chrome.storage.local.get("telescopeData", (result) => {
      sendResponse(result.telescopeData || {});
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "forceUpdate") {
    tryUpdateFromGitHub().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
