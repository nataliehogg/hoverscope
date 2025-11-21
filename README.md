# 🔭 hoverscope

**Hover over telescope and satellite names on arXiv to see key specifications instantly.**

Hoverscope is a browser extension that detects mentions of telescopes, satellites, astronomical instruments, simulations, and semi-analytic models in arXiv papers and displays detailed information when you hover over them.

![demo](https://github.com/user-attachments/assets/b29f4be1-001d-4eab-8127-37eb573be266)

## Features

- ✨ **Instant Information**: Hover over names to see specifications instantly
- 🔄 **Auto-updating**: Database updates automatically from GitHub
- 🌓 **Dark Mode**: Adapts to your system preferences
- 📚 **Comprehensive**: Covers major space/ground telescopes and instruments, as well as contempary and historical simulations and Semi-Analytic Models (SAMs)
- 🎯 **arXiv Optimised**: Works seamlessly on paper titles, abstracts and arXiv's html view

## Information Displayed

For each telescope/satellite, Hoverscope shows:

- **Type** (Space telescope, radio interferometer, etc.)
- **Launch Date** (or operational dates)
- **Wavelength Coverage** (UV, visible, infrared, radio, etc.)
- **Survey Area** (for survey instruments)
- **Location** (orbit, ground location)
- **Status** (Operational, decommissioned, in development)
- **Brief Description**

For each simulation Hoverscope shows:

- **Type** (Cosmological simulation, Suite, Zoom re-simulation, etc.)
- **Volume** (box size)
- **Mass Resolution**
- **Included Physics** (e.g. dark matter only, hydrodynamics, feedback models)
- **Sub-grid Model** (the name of the sub-grid model used, if applicable)
- **Code Used** (e.g. SWIFT, GADGET, AREPO, RAMSES
- **Brief Description**

For each Semi-Analytic Model (SAM) Hoverscope shows:

- **Included Physics** (e.g. cooling, star formation, feedback models)
- **Dark Matter Simulation Used** (e.g. Millennium, Bolshoi)
- **Mass Resolution** (of the underlying dark matter simulation)
- **Merger Tree Code** (e.g. Consistent Trees, DTrees)
- **Brief Description**

## Installation

### From Browser Stores (Simplest)

- [**Chrome Web Store**](https://chromewebstore.google.com/detail/hoverscope/lhhdkflffdlgbmcmlmhklkghbgbegghn?utm_source=item-share-cb&pli=1)
- [**Firefox Add-ons**](https://addons.mozilla.org/en-GB/firefox/addon/hoverscope/)

### Manual Installation (For Development)

Since Chrome and Firefox require different manifest configurations, you'll need to copy the appropriate manifest file first.

#### Prerequisites

Clone or download this repository:

```bash
git clone https://github.com/nataliehogg/hoverscope.git
cd hoverscope
```

#### Installing in Chrome

1. Copy the Chrome manifest:
   ```bash
   cp manifest.chrome.json manifest.json
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `hoverscope` folder
6. Done! Visit arXiv and hover over telescope names

#### Installing in Firefox

1. Copy the Firefox manifest:
   ```bash
   cp manifest.firefox.json manifest.json
   ```
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to the `hoverscope` folder and select `manifest.json`
5. Done! (Note: temporary add-ons are removed when Firefox restarts)

For permanent Firefox installation, the extension needs to be signed by Mozilla or you need to use Firefox Developer Edition with `xpinstall.signatures.required` set to `false`.

## Updates

When a new release of the code is published on Github, that release will also be made available on the webstores. This is not automatic, and there may be a short delay (~hours) between the release on Github and the update propagating to the webstores, as the updates have to be reviewed each time. This means that the most up-to-date stable version of `hoverscope` will always be the one available from the main branch of this repository. Note that you will have to reload the extension in your browser after pulling from the repository to ensure updates propagate to your live version.

## Usage

Just browse arXiv normally! Hoverscope automatically detects telescope and satellite names in paper titles, abstracts and HTML view.

When you hover over a recognised name (like "JWST", "Hubble", "ALMA"), a tooltip appears with detailed information.

## Current Database

Hoverscope currently recognises **30+ telescopes and instruments**, including:

**Space Telescopes:**

- James Webb Space Telescope (JWST)
- Hubble Space Telescope (HST)
- Chandra X-ray Observatory
- Spitzer Space Telescope
- Kepler
- TESS
- Gaia
- Euclid
- Nancy Grace Roman Space Telescope
- And more...

**Ground-Based:**

- ALMA
- VLA (Very Large Array)
- SKA (Square Kilometre Array)
- SDSS (Sloan Digital Sky Survey)
- Vera Rubin Observatory (LSST)

**Instruments:**

- JWST instruments (MIRI, NIRSpec, NIRCam)
- And more...

**Simulations:**

- EAGLE
- IllustrisTNG
- COLIBRE
- FLAMINGO
- Simba
- Thesan
- And more...

**Semi-Analytic Models (SAMs):**

- L-GALAXIES
- GALFORM
- SCSAM
- And more...

The extension automatically checks for database updates daily. The database is stored as a JSON file that can be easily updated.

## Contributing

Want to add more telescopes or improve the extension? Contributions welcome!

1. Fork the repository
2. (For a telescope) Add telescope data to `telescope.json` following this format:

```json
{
  "telescope_id": {
    "name": "Official Name",
    "aliases": ["Alternative Name 1", "Acronym"],
    "type": "Space Telescope",
    "launch_date": "Month Day, Year",
    "wavelengths": "UV to near-infrared (100-2500 nm)",
    "survey_area": "5000 sq deg",
    "location": "L2 Lagrange Point",
    "status": "Operational",
    "description": "Brief description of the mission"
  }
}
```

4. Test locally
5. Submit a pull request

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Framework**: Vanilla JavaScript (no dependencies)
- **Storage**: Chrome Storage API with automatic syncing
- **Update Mechanism**: Daily automatic checks via background service worker

## Privacy

Hoverscope:

- ✅ Only runs on arXiv.org
- ✅ Does not collect any user data
- ✅ Does not track browsing history
- ✅ Minimal permissions (storage only)
- ✅ All data processing happens locally in your browser

A full privacy statement can be found at [PRIVACY.md](https://github.com/nataliehogg/hoverscope/blob/main/PRIVACY.md).

## License

MIT License - feel free to use, modify, and distribute!

## Credits

Telescope data compiled from NASA, ESA, and observatory official sources.

---

**Made with ❤️ (and claude) for the astronomy community**
