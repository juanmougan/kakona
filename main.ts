import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Config {
  zipcodes: string[];
  mapConfig: {
    center: [number, number];
    zoom: number;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWeight: number;
  };
}

class Kakona {
  private map: L.Map;
  private config: Config;
  private layerGroup: L.LayerGroup;
  private searchLayerGroup: L.LayerGroup;

  constructor(config: Config) {
    this.config = config;
    this.layerGroup = L.layerGroup();
    this.searchLayerGroup = L.layerGroup();
    
    // Initialize the map
    this.map = L.map('map').setView(
      this.config.mapConfig.center,
      this.config.mapConfig.zoom
    );

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.layerGroup.addTo(this.map);
    this.searchLayerGroup.addTo(this.map);
  }

  /**
   * Fetches GeoJSON data for a Dutch zip code (4-digit postal code)
   * Using the PDOK BAG service or Nominatim as fallback
   */
  private async fetchZipcodeGeometry(zipcode: string): Promise<any> {
    try {
      // Try PDOK service first (Dutch government geodata service)
      // PC4 = 4-digit postal code areas
      const pdokUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=postcode:${zipcode}&fq=type:postcode&rows=1`;
      
      const response = await fetch(pdokUrl);
      const data = await response.json();

      if (data.response?.docs?.length > 0) {
        const doc = data.response.docs[0];

        // Get the centroid coordinates - format is "POINT(longitude latitude)"
        if (doc.centroide_ll) {
          const coordinateMatch = doc.centroide_ll.match(/POINT\(([^\)]+)\)/);
          if (coordinateMatch) {
            const [lon, lat] = coordinateMatch[1].split(' ').map(Number);
            if (!isNaN(lat) && !isNaN(lon)) {
              // For PC4 areas, we'll create an approximate polygon
              // In production, you'd want actual boundary data
              return this.createApproximatePolygon(lat, lon, zipcode);
            }
          }
        }
      }

      // Fallback: try to get boundaries from Nominatim
      return await this.fetchFromNominatim(zipcode);
      
    } catch (error) {
      console.error(`Error fetching zipcode ${zipcode}:`, error);
      return null;
    }
  }

  /**
   * Creates an approximate polygon around a center point
   * This is a simplified approach - for production use actual boundary data
   */
  private createApproximatePolygon(lat: number, lon: number, zipcode: string): any {
    // Create a roughly 2km radius circle approximation
    const radius = 0.02; // approximately 2km
    const points = 20;
    const coordinates: [number, number][] = [];

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const latOffset = radius * Math.cos(angle);
      const lonOffset = radius * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
      
      coordinates.push([lat + latOffset, lon + lonOffset]);
    }
    
    // Close the polygon
    coordinates.push(coordinates[0]);

    return {
      type: 'Feature',
      properties: { postcode: zipcode },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates.map(c => [c[1], c[0]])] // [lon, lat] for GeoJSON
      }
    };
  }

  /**
   * Fallback method using Nominatim for zip code lookup
   */
  private async fetchFromNominatim(zipcode: string): Promise<any> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=Netherlands&polygon_geojson=1&format=json`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Kakona/1.0'
        }
      });
      
      const data = await response.json();
      
      if (data.length > 0 && data[0].geojson) {
        return {
          type: 'Feature',
          properties: { postcode: zipcode },
          geometry: data[0].geojson
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Nominatim error for ${zipcode}:`, error);
      return null;
    }
  }

  /**
   * Plots a single zipcode on the map
   */
  private plotZipcode(geojson: any): void {
    if (!geojson) return;

    const layer = L.geoJSON(geojson, {
      style: {
        fillColor: this.config.mapConfig.fillColor,
        fillOpacity: this.config.mapConfig.fillOpacity,
        color: this.config.mapConfig.strokeColor,
        weight: this.config.mapConfig.strokeWeight
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties?.postcode) {
          layer.bindPopup(`Postcode: ${feature.properties.postcode}`);
        }
      }
    });

    layer.addTo(this.layerGroup);
  }

  /**
   * Main method to plot all zipcodes from the configuration
   */
  public async plotAllZipcodes(): Promise<void> {
    const statusDiv = document.getElementById('status');
    
    if (statusDiv) {
      statusDiv.textContent = 'Loading zip codes...';
    }

    let successCount = 0;
    let failCount = 0;

    for (const zipcode of this.config.zipcodes) {
      try {
        if (statusDiv) {
          statusDiv.textContent = `Loading: ${zipcode}...`;
        }

        const geometry = await this.fetchZipcodeGeometry(zipcode);
        
        if (geometry) {
          this.plotZipcode(geometry);
          successCount++;
        } else {
          console.warn(`Could not find geometry for zipcode: ${zipcode}`);
          failCount++;
        }

        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing zipcode ${zipcode}:`, error);
        failCount++;
      }
    }

    if (statusDiv) {
      statusDiv.textContent = `Loaded ${successCount} zip codes successfully${failCount > 0 ? `, ${failCount} failed` : ''}`;
    }

    // Fit the map to show all plotted areas
    const layers = this.layerGroup.getLayers();
    if (layers.length > 0) {
      const group = new L.FeatureGroup(layers as L.Layer[]);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }

  /**
   * Clears all plotted zipcodes from the map
   */
  public clearAll(): void {
    this.layerGroup.clearLayers();
  }

  /**
   * Trims letters from zipcode input (e.g., "3572RB" -> "3572")
   */
  private trimZipcode(input: string): string {
    return input.replace(/[A-Za-z]/g, '');
  }


  /**
   * Plots a zipcode with custom styling
   */
  private async plotZipcodeWithStyle(zipcode: string, color: string, isPolluted: boolean): Promise<void> {
    const geometry = await this.fetchZipcodeGeometry(zipcode);
    if (!geometry) return;

    const layer = L.geoJSON(geometry, {
      style: {
        fillColor: color,
        fillOpacity: 0.7,
        color: color,
        weight: 3
      },
      onEachFeature: (_, layer) => {
        const message = isPolluted ? 'POLLUTED WATER!' : 'Safe to drink';
        layer.bindPopup(`Postcode: ${zipcode}<br/><strong>${message}</strong>`);
      }
    });

    layer.addTo(this.searchLayerGroup);
  }

  /**
   * Searches for a zipcode and displays results
   */
  public async searchZipcode(input: string): Promise<void> {
    const resultDiv = document.getElementById('searchResult');
    if (!resultDiv) return;

    // Clear previous search results
    this.clearSearch();

    // Trim letters from input
    const zipcode = this.trimZipcode(input.trim());

    if (!zipcode || zipcode.length !== 4) {
      resultDiv.innerHTML = '<span style="color: #e74c3c;">Please enter a valid 4-digit zipcode</span>';
      return;
    }

    resultDiv.textContent = 'Checking...';

    try {
      // Check if zipcode is in polluted list
      if (this.config.zipcodes.includes(zipcode)) {
        // Polluted water - paint red
        await this.plotZipcodeWithStyle(zipcode, '#e74c3c', true);
        resultDiv.innerHTML = '<span class="polluted-text">Your water supply might be polluted! 💩</span>';
      } else {
        // Safe water - paint green
        await this.plotZipcodeWithStyle(zipcode, '#27ae60', false);
        resultDiv.innerHTML = '<span class="safe-text">Your water supply is safe to drink! 💧</span>';
      }

      // Zoom to the searched zipcode
      const geometry = await this.fetchZipcodeGeometry(zipcode);
      if (geometry && geometry.geometry?.coordinates?.[0]) {
        const coords = geometry.geometry.coordinates[0];
        const bounds = L.latLngBounds(coords.map((c: number[]) => [c[1], c[0]]));
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }

    } catch (error) {
      console.error('Search error:', error);
      resultDiv.innerHTML = '<span style="color: #e74c3c;">Error searching zipcode</span>';
    }
  }

  /**
   * Clears search results
   */
  public clearSearch(): void {
    this.searchLayerGroup.clearLayers();
    const resultDiv = document.getElementById('searchResult');
    if (resultDiv) {
      resultDiv.textContent = '';
    }
  }
}

// Initialize the mapper when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Fetch the configuration file
    const response = await fetch('./config.json');
    const config: Config = await response.json();

    // Create the mapper instance
    const mapper = new Kakona(config);

    // Plot all zipcodes
    await mapper.plotAllZipcodes();

    // Add event listener for the reload button
    const reloadButton = document.getElementById('reload');
    if (reloadButton) {
      reloadButton.addEventListener('click', async () => {
        mapper.clearAll();
        await mapper.plotAllZipcodes();
      });
    }

    // Add event listeners for search functionality
    const searchButton = document.getElementById('searchButton');
    const clearButton = document.getElementById('clearButton');
    const zipcodeInput = document.getElementById('zipcodeInput') as HTMLInputElement;

    if (searchButton && zipcodeInput) {
      searchButton.addEventListener('click', async () => {
        await mapper.searchZipcode(zipcodeInput.value);
      });

      // Also search on Enter key press
      zipcodeInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          await mapper.searchZipcode(zipcodeInput.value);
        }
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        mapper.clearSearch();
        if (zipcodeInput) {
          zipcodeInput.value = '';
        }
      });
    }

  } catch (error) {
    console.error('Error initializing mapper:', error);
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = 'Error loading configuration';
    }
  }
});
