// GPS Collector Application Logic
// Handles geolocation, data display, saving, and local storage

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

    // State variables
    let currentPositionData = null;      // Stores latest GPS object
    let watchId = null;                   // For continuous watching (optional but we'll use single shot)
    let isLocating = false;

    // Local storage key for history
    const STORAGE_KEY = 'gps_location_history';

    // Load saved history from localStorage
    let savedLocations = [];

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations.slice(0, 10))); // keep last 10
        renderHistory();
    }

    // Render the history list in the UI
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
                    <button class="btn btn-sm btn-outline-secondary view-coord-btn" data-lat="${loc.lat}" data-lng="${loc.lng}" data-idx="${idx}" style="font-size:0.7rem;">
                        <i class="fas fa-eye"></i>
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
                if (!isNaN(lat) && !isNaN(lng)) {
                    // Update current display with selected history item (preview)
                    if (currentPositionData) {
                        // optional, but we can show a temporary preview
                        alert(`📍 Viewing saved location:\nLat: ${lat.toFixed(6)}\nLng: ${lng.toFixed(6)}\n(not overwriting current GPS)`);
                    } else {
                        latValue.textContent = lat.toFixed(6);
                        lngValue.textContent = lng.toFixed(6);
                        statusBadge.innerHTML = `📜 History preview`;
                        statusBadge.className = 'badge px-3 py-2 rounded-pill bg-info text-dark';
                    }
                }
            });
        });
    }

    // Helper: update UI with position object
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
        
        // Extra metadata (source method, provider)
        sourceMethodSpan.textContent = position.coords.altitudeAccuracy !== undefined ? 'hybrid' : 'gps/network';
        providerInfoSpan.textContent = position.coords.accuracy < 50 ? 'GPS fix' : (position.coords.accuracy < 200 ? 'Network assisted' : 'Approximate');
        
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
        
        // Show temporary feedback in the extra area
        const extraMetaDiv = document.getElementById('extraMeta');
        if (extraMetaDiv) {
            // not overwriting, but we can add a small warning
        }
    }
    
    // Success callback from geolocation
    function handleGeoSuccess(position) {
        isLocating = false;
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = '<i class="fas fa-location-dot me-2"></i>Get GPS Location';
        getLocationBtn.classList.remove('btn-loading');
        
        updateUIWithPosition(position);
        
        // auto-show small feedback after 2 sec if needed (optional)
        setTimeout(() => {
            if (saveFeedback.classList.contains('d-none') === false) {
                // keep it but we'll manage independently
            }
        }, 300);
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
    
    // Main function to request GPS location (high accuracy)
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
        
        // Reset status temporary
        statusBadge.innerHTML = `🛰️ Getting location...`;
        statusBadge.className = 'badge px-3 py-2 rounded-pill bg-warning text-dark';
        
        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };
        
        navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, options);
    }
    
    // Save current GPS data to history & show feedback
    function saveCurrentData() {
        if (!currentPositionData) {
            saveMessageSpan.textContent = 'No GPS data available. Get location first.';
            saveFeedback.classList.remove('d-none');
            setTimeout(() => {
                saveFeedback.classList.add('d-none');
            }, 2000);
            return;
        }
        
        // Create a clean record
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
        
        // Show success feedback
        saveMessageSpan.innerHTML = `✅ Saved: ${record.lat.toFixed(4)}°, ${record.lng.toFixed(4)}°`;
        saveFeedback.classList.remove('d-none');
        setTimeout(() => {
            saveFeedback.classList.add('d-none');
        }, 2500);
        
        // subtle visual enhancement: button pulse
        saveDataBtn.style.transform = 'scale(0.98)';
        setTimeout(() => { saveDataBtn.style.transform = ''; }, 150);
    }
    
    // Clear entire history
    function clearHistory() {
        if (confirm('Delete all saved locations?')) {
            savedLocations = [];
            saveHistoryToStorage();
            renderHistory();
            const tempDiv = document.getElementById('saveFeedback');
            if (tempDiv) {
                saveMessageSpan.innerHTML = '🗑️ History cleared.';
                saveFeedback.classList.remove('d-none');
                setTimeout(() => saveFeedback.classList.add('d-none'), 1800);
            }
        }
    }
    
    // Event Listeners
    getLocationBtn.addEventListener('click', requestGPSLocation);
    saveDataBtn.addEventListener('click', saveCurrentData);
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Initialize: load history from storage and set default UI state
    loadHistoryFromStorage();
    
    // Optional: check if geolocation is available, set initial status
    if (!navigator.geolocation) {
        showError('Browser does not support Geolocation', true);
        getLocationBtn.disabled = true;
    }
    
    // On page load, maybe a hint
    console.log('GPS Collector ready — request location using button');
})();