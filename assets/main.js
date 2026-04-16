// GPS Collector Application Logic with Live Map Integration
// Handles geolocation, data display, saving, local storage, and interactive map

(function() {
    // DOM Elements
    const getLocationBtn = document.getElementById('getLocationBtn');
    const saveDataBtn = document.getElementById('saveDataBtn');
    const statusBadge = document.getElementById('statusBadge');
    const accuracyTag = document.getElementById('accuracyTag');
    const latValue = document.getElementById('latValue');
    const lngValue = document.getElementById('lngValue');
    const altValue = document.getElementById('altValue');
    const accValue = document.getElementById('accValue');
    const speedValue = document.getElementById('speedValue');
    const timeValue = document.getElementById('timeValue');
    const sourceMethodSpan = document.getElementById('sourceMethod');
    const providerInfoSpan = document.getElementById('providerInfo');
    const saveFeedback = document.getElementById('saveFeedback');
    const saveMessageSpan = document.getElementById('saveMessage');
    const historyListDiv = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const mapContainer = document.getElementById('mapContainer');
    const mapDiv = document.getElementById('map');

    // State variables
    let currentPositionData = null;
    let watchId = null;
    let isLocating = false;
    let mapInstance = null;      // Leaflet map instance
    let currentMarker = null;    // Current position marker
    let currentCircle = null;    // Accuracy circle

    // Local storage key for history
    const STORAGE_KEY = 'gps_location_history';
    let savedLocations = [];

    // Initialize map (but don't show until we have coordinates)
    function initMap(lat, lng, accuracy) {
        if (mapInstance) {
            // Update existing map view
            mapInstance.setView([lat, lng], 16);
            if (currentMarker) {
                currentMarker.setLatLng([lat, lng]);
            } else {
                currentMarker = L.marker([lat, lng]).addTo(mapInstance)
                    .bindPopup('<b>📍 Your Location</b><br>Lat: ' + lat.toFixed(6) + '<br>Lng: ' + lng.toFixed(6))
                    .openPopup();
            }
            if (currentCircle) {
                currentCircle.setLatLng([lat, lng]);
                if (accuracy && accuracy > 0) {
                    currentCircle.setRadius(accuracy);
                }
            } else if (accuracy && accuracy > 0) {
                currentCircle = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#1e7e8c',
                    fillColor: '#1e7e8c',
                    fillOpacity: 0.15,
                    weight: 2
                }).addTo(mapInstance);
            }
        } else {
            // Create new map
            mapInstance = L.map(mapDiv).setView([lat, lng], 16);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
                subdomains: 'abcd',
                maxZoom: 19,
                minZoom: 3
            }).addTo(mapInstance);
            
            currentMarker = L.marker([lat, lng]).addTo(mapInstance)
                .bindPopup('<b>📍 Your Location</b><br>Lat: ' + lat.toFixed(6) + '<br>Lng: ' + lng.toFixed(6))
                .openPopup();
            
            if (accuracy && accuracy > 0) {
                currentCircle = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#1e7e8c',
                    fillColor: '#1e7e8c',
                    fillOpacity: 0.15,
                    weight: 2
                }).addTo(mapInstance);
            }
        }
        
        // Show map container
        if (mapContainer) mapContainer.style.display = 'block';
        
        // Force map to refresh after a short delay (fixes rendering issues)
        setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
        }, 100);
    }

    // Load history from localStorage
    function loadHistoryFromStorage() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                savedLocations = JSON.parse(stored);
                if (!Array.isArray(savedLocations)) savedLocations = [];
            } catch(e) {
                savedLocations = [];
            }
        } else {
            savedLocations = [];
        }
        renderHistory();
    }

    function saveHistoryToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations.slice(0, 10)));
        renderHistory();
    }

    // Render history list
    function renderHistory() {
        if (!historyListDiv) return;
        
        if (savedLocations.length === 0) {
            historyListDiv.innerHTML = '<div class="text-muted fst-italic text-center py-2">No saved data yet</div>';
            return;
        }
        
        const historyHtml = savedLocations.map((loc, idx) => {
            const date = new Date(loc.timestamp);
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' });
            return `
                <div class="history-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>📍 ${loc.lat.toFixed(5)}°, ${loc.lng.toFixed(5)}°</strong>
                        <div class="text-muted small">${formattedTime} | acc: ${loc.accuracy}m</div>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary view-coord-btn" data-lat="${loc.lat}" data-lng="${loc.lng}" data-acc="${loc.accuracy}" data-idx="${idx}" style="font-size:0.7rem;">
                        <i class="fas fa-map-marker-alt"></i> Map
                    </button>
                </div>
            `;
        }).join('');
        
        historyListDiv.innerHTML = historyHtml;
        
        // Attach event listeners to view buttons
        document.querySelectorAll('.view-coord-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const lat = parseFloat(btn.getAttribute('data-lat'));
                const lng = parseFloat(btn.getAttribute('data-lng'));
                const acc = parseFloat(btn.getAttribute('data-acc'));
                if (!isNaN(lat) && !isNaN(lng)) {
                    // Show saved location on map without overwriting current GPS data
                    if (mapInstance) {
                        mapInstance.setView([lat, lng], 15);
                        // Add a temporary marker for the saved location
                        const tempMarker = L.marker([lat, lng]).addTo(mapInstance)
                            .bindPopup('<b>📌 Saved Location</b><br>Lat: ' + lat.toFixed(6) + '<br>Lng: ' + lng.toFixed(6))
                            .openPopup();
                        // Remove temp marker after 3 seconds
                        setTimeout(() => {
                            if (mapInstance && tempMarker) mapInstance.removeLayer(tempMarker);
                        }, 3000);
                    } else {
                        // If map not initialized yet, show alert
                        alert(`📍 Saved location:\nLat: ${lat.toFixed(6)}\nLng: ${lng.toFixed(6)}\nGet GPS location first to activate map.`);
                    }
                }
            });
        });
    }

    // Update UI with position and map
    function updateUIWithPosition(position) {
        const coords = position.coords;
        const timestamp = new Date(position.timestamp);
        
        // Update values
        latValue.textContent = coords.latitude ? coords.latitude.toFixed(6) : '—';
        lngValue.textContent = coords.longitude ? coords.longitude.toFixed(6) : '—';
        altValue.textContent = coords.altitude !== null && coords.altitude !== undefined ? 
            `${coords.altitude.toFixed(1)} m` : '—';
        accValue.textContent = coords.accuracy !== null ? `${Math.round(coords.accuracy)} m` : '—';
        
        // Speed conversion: m/s to km/h
        let speedKmh = '—';
        if (coords.speed !== null && coords.speed !== undefined && !isNaN(coords.speed)) {
            speedKmh = (coords.speed * 3.6).toFixed(1) + ' km/h';
        }
        speedValue.textContent = speedKmh;
        timeValue.textContent = timestamp.toLocaleString();
        
        // Accuracy badge style
        if (coords.accuracy) {
            const accMeters = coords.accuracy;
            if (accMeters < 20) accuracyTag.innerHTML = `<i class="fas fa-check-circle"></i> High accuracy (±${Math.round(accMeters)}m)`;
            else if (accMeters < 100) accuracyTag.innerHTML = `<i class="fas fa-chart-line"></i> Medium accuracy (±${Math.round(accMeters)}m)`;
            else accuracyTag.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Low accuracy (±${Math.round(accMeters)}m)`;
            accuracyTag.className = 'badge bg-secondary bg-opacity-25 text-dark px-3 py-2 rounded-pill';
        } else {
            accuracyTag.innerHTML = '—';
        }
        
        // Extra metadata
        sourceMethodSpan.textContent = position.coords.altitudeAccuracy !== undefined ? 'hybrid' : 'gps/network';
        providerInfoSpan.textContent = coords.accuracy < 50 ? 'GPS fix' : (coords.accuracy < 200 ? 'Network assisted' : 'Approximate');
        
        // Store current data for saving
        currentPositionData = {
            lat: coords.latitude,
            lng: coords.longitude,
            altitude: coords.altitude,
            accuracy: coords.accuracy,
            speed: coords.speed,
            timestamp: position.timestamp,
            formattedTime: timestamp.toISOString(),
            provider: providerInfoSpan.textContent
        };
        
        // Enable save button
        saveDataBtn.disabled = false;
        statusBadge.innerHTML = `✅ GPS Ready`;
        statusBadge.className = 'badge px-3 py-2 rounded-pill bg-success text-white';
        
        // Update or create map with current coordinates
        if (coords.latitude && coords.longitude) {
            initMap(coords.latitude, coords.longitude, coords.accuracy);
        }
    }
    
    function showError(message, isGeoError = false) {
        statusBadge.innerHTML = `⚠️ ${message}`;
        statusBadge.className = 'badge px-3 py-2 rounded-pill bg-danger text-white';
        accuracyTag.innerHTML = '—';
        saveDataBtn.disabled = true;
        currentPositionData = null;
        
        if (isGeoError) {
            latValue.textContent = '—';
            lngValue.textContent = '—';
            altValue.textContent = '—';
            accValue.textContent = '—';
            speedValue.textContent = '—';
            timeValue.textContent = '—';
            sourceMethodSpan.textContent = '—';
            providerInfoSpan.textContent = '—';
        }
    }
    
    function handleGeoSuccess(position) {
        isLocating = false;
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = '<i class="fas fa-location-dot me-2"></i>Get GPS Location';
        getLocationBtn.classList.remove('btn-loading');
        updateUIWithPosition(position);
    }
    
    function handleGeoError(error) {
        isLocating = false;
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = '<i class="fas fa-location-dot me-2"></i>Get GPS Location';
        getLocationBtn.classList.remove('btn-loading');
        
        let errorMsg = '';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMsg = 'Permission denied. Allow location access.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMsg = 'GPS signal unavailable. Try outdoors.';
                break;
            case error.TIMEOUT:
                errorMsg = 'Location request timed out.';
                break;
            default:
                errorMsg = 'Unknown error.';
        }
        showError(errorMsg, true);
    }
    
    function requestGPSLocation() {
        if (isLocating) return;
        
        if (!navigator.geolocation) {
            showError('Geolocation not supported by browser', true);
            return;
        }
        
        isLocating = true;
        getLocationBtn.disabled = true;
        getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-pulse me-2"></i>Acquiring GPS...';
        getLocationBtn.classList.add('btn-loading');
        
        statusBadge.innerHTML = `🛰️ Getting location...`;
        statusBadge.className = 'badge px-3 py-2 rounded-pill bg-warning text-dark';
        
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };
        
        navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, options);
    }
    
    function saveCurrentData() {
        if (!currentPositionData) {
            saveMessageSpan.textContent = 'No GPS data available. Get location first.';
            saveFeedback.classList.remove('d-none');
            setTimeout(() => {
                saveFeedback.classList.add('d-none');
            }, 2000);
            return;
        }
        
        const record = {
            id: Date.now(),
            lat: currentPositionData.lat,
            lng: currentPositionData.lng,
            altitude: currentPositionData.altitude,
            accuracy: currentPositionData.accuracy,
            speed: currentPositionData.speed,
            timestamp: currentPositionData.timestamp,
            savedAt: new Date().toISOString(),
            readableTime: new Date(currentPositionData.timestamp).toLocaleString()
        };
        
        savedLocations.unshift(record);
        if (savedLocations.length > 10) savedLocations.pop();
        saveHistoryToStorage();
        
        saveMessageSpan.innerHTML = `✅ Saved: ${record.lat.toFixed(4)}°, ${record.lng.toFixed(4)}°`;
        saveFeedback.classList.remove('d-none');
        setTimeout(() => {
            saveFeedback.classList.add('d-none');
        }, 2500);
        
        saveDataBtn.style.transform = 'scale(0.98)';
        setTimeout(() => { saveDataBtn.style.transform = ''; }, 150);
    }
    
    function clearHistory() {
        if (confirm('Delete all saved locations?')) {
            savedLocations = [];
            saveHistoryToStorage();
            renderHistory();
            saveMessageSpan.innerHTML = '🗑️ History cleared.';
            saveFeedback.classList.remove('d-none');
            setTimeout(() => saveFeedback.classList.add('d-none'), 1800);
        }
    }
    
    // Event Listeners
    getLocationBtn.addEventListener('click', requestGPSLocation);
    saveDataBtn.addEventListener('click', saveCurrentData);
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Initialize: load history and set default UI
    loadHistoryFromStorage();
    
    if (!navigator.geolocation) {
        showError('Browser does not support Geolocation', true);
        getLocationBtn.disabled = true;
    }
    
    console.log('GPS Collector with Map ready — request location using button');
})();
