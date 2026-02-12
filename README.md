# Global Defense AI Policy Landscape

Interactive visualization of military AI governance frameworks across 46 nations.

## Repository Structure

```
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All CSS styles
├── js/
│   └── main.js         # Main application JavaScript
├── data/
│   └── policy-data.json # Policy database (46 countries, 473 policies)
└── README.md           # This file
```

## Features

- **Interactive World Map**: Explore countries by clicking on the map
- **Timeline Slider**: View policy evolution from 2016-2025
- **Country Profiles**: Detailed policy breakdowns by category
- **Compare View**: Side-by-side comparison of up to 2 countries
- **Analytics Dashboard**:
  - Policy Momentum Chart (with country search)
  - Global Policy Growth (quarterly histogram)
  - Convergence/Divergence Timeline
- **Alliance Filtering**: NATO, AUKUS, Five Eyes, Quad, EU, SCO

## Policy Categories

1. LAWS Employment/Deployment
2. Adoption & Intent of Use
3. Acquisition & Procurement
4. Technical Safety & Security Requirements
5. Ethical Guidelines & Restrictions
6. International Cooperation & Interoperability

## Data Coverage

- **Countries**: 46
- **Total Policies**: 473
- **Date Range**: 2016 - Present
- **Last Updated**: December 2025

## Usage

### Local Development

To run locally, you need a web server due to CORS restrictions when loading JSON:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Deployment

Upload all files maintaining the folder structure to any static web host.

## Dependencies

- D3.js v7.8.5 (loaded from CDN)
- TopoJSON v3.0.2 (loaded from CDN)
- Google Fonts (Inter, Plus Jakarta Sans)

## Browser Support

Modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge).

## Credits

Research data compiled from official government documents, national document submissions, public statements, press releases, and secondary sources.

Data current as of December 2025.
