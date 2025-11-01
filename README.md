# Kakona

A TypeScript application to visualize Dutch postal code areas on an interactive map using Leaflet.

## Features

- 📍 Plots Dutch 4-digit postal codes (PC4) on a map
- 🗺️ Interactive map with zoom and pan capabilities
- ⚙️ Configurable via JSON file
- 🎨 Customizable colors and styling
- 🔄 Real-time data fetching from PDOK (Dutch government geodata service)

## Installation

1. Make sure you have Node.js installed (version 16 or higher)

2. Install dependencies:
```bash
npm install
```

## Configuration

Edit the `config.json` file to customize your map:

```json
{
  "zipcodes": [
    "1951",  // Your zip codes here (4-digit format)
    "1945",
    "2011"
  ],
  "mapConfig": {
    "center": [52.3676, 4.9041],  // Starting map center [lat, lon]
    "zoom": 8,                     // Initial zoom level
    "fillColor": "#3388ff",        // Area fill color
    "fillOpacity": 0.4,            // Fill transparency (0-1)
    "strokeColor": "#0066cc",      // Border color
    "strokeWeight": 2              // Border width in pixels
  }
}
```

### Dutch Zip Code Format

- Use 4-digit postal codes (PC4 areas) like `1951`, `2011`, `3011`
- Do not include the 2-letter suffix (e.g., use `1951` not `1951VZ`)

## Usage

### Development Mode

Run the development server:

```bash
npm run dev
```

Then open your browser to the URL shown (usually `http://localhost:5173`)

### Production Build

Build for production:

```bash
npm run build
```

The built files will be in the `dist` folder.

## How It Works

1. **Configuration Loading**: The script reads `config.json` on page load
2. **Data Fetching**: For each zip code, it queries:
   - Primary: PDOK Locatieserver (Dutch government geodata)
   - Fallback: OpenStreetMap Nominatim API
3. **Visualization**: Areas are drawn on the map with the configured styling
4. **Interaction**: Click on any area to see its postal code

## API Services Used

- **PDOK Locatieserver**: Dutch government's public geodata service
  - Free to use
  - No API key required
  - Rate limit: Be reasonable with requests

- **Nominatim (Fallback)**: OpenStreetMap geocoding service
  - Free to use
  - Requires User-Agent header
  - Rate limit: Max 1 request/second

## Customization

### Changing Map Style

Edit the `fillColor`, `strokeColor`, and opacity values in `config.json`.

### Adding More Zip Codes

Simply add more 4-digit codes to the `zipcodes` array in `config.json`.

### Modifying the Appearance

Edit the CSS in `index.html` to change the header, buttons, or info box styling.

## Troubleshooting

**Zip codes not showing up:**
- Verify the zip code format (4 digits only)
- Check browser console for errors
- Some remote areas may not have boundary data available

**Map not loading:**
- Check your internet connection
- Ensure all dependencies are installed
- Try clearing browser cache

**Rate limiting:**
- The script includes 500ms delays between requests
- For many zip codes, consider using a local dataset instead

## Data Sources

- Postal code boundaries: PDOK (Publieke Dienstverlening Op de Kaart)
- Base map tiles: OpenStreetMap
- Geocoding fallback: Nominatim

## License

This project is provided as-is for educational and personal use.

## Future Enhancements

- Support for 6-digit postal codes (PC6)
- Local boundary data file for offline use
- Export functionality (PNG, GeoJSON)
- Clustering for large numbers of zip codes
- Heat map visualization
- CSV import for zip codes
