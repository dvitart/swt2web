document.addEventListener('DOMContentLoaded', () => {
    // DOM-Elemente
    const fileInput = document.getElementById('swt-file-input');
    const uploadSection = document.getElementById('upload-section');
    const displaySection = document.getElementById('display-section');
    const comingSoonSection = document.getElementById('coming-soon-section'); // NEU
    const tournamentNameEl = document.getElementById('tournament-name');
    const roundTitleEl = document.getElementById('round-title');
    const tablesContainerEl = document.getElementById('tables-container');
    const legendEl = document.getElementById('legend');
    const paginationInfoEl = document.getElementById('pagination-info');

    // Zustand für die Paginierung
    let currentPage = 0;
    const pageSize = 50;
    let totalPages = 0;
    let allPairings = [];
    let paginationInterval = null;

    const colorScheme = {
        'A-F': { class: 'color-group-a' },
        'G-L': { class: 'color-group-b' },
        'M-R': { class: 'color-group-c' },
        'S-Z': { class: 'color-group-d' },
    };

    // --- INITIALISIERUNG ---
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('deviceId');

    if (deviceId) {
        // Modus 1: API-Polling
        uploadSection.classList.add('hidden');
        console.log(`Geräte-ID '${deviceId}' gefunden. Starte API-Polling.`);
        TournamentFetcher.start(deviceId, 20000);
        setInterval(checkForUpdates, 5000);
        checkForUpdates();

    } else {
        // Modus 2: Fallback auf manuellen Dateiupload
        console.log("Keine Geräte-ID gefunden. Manuelle Dateiupload-Logik aktiv.");
        const storedData = sessionStorage.getItem('swtJsonData');
        if (storedData) {
            try {
                const parsedStoredData = JSON.parse(storedData);
                if(parsedStoredData.jsonData) {
                    setupDisplay(parsedStoredData.jsonData);
                }
            } catch (e) {
                console.error("Fehler beim Parsen der Daten aus sessionStorage:", e);
                sessionStorage.removeItem('swtJsonData');
            }
        }
    }

    /**
     * Kernfunktion im API-Modus: Prüft auf Updates und stößt die Anzeige an.
     */
    async function checkForUpdates() {
        const config = TournamentFetcher.getConfig();
        if (!config || !config.swtUrl || config.error) {
            console.log("Warte auf gültige Konfigurationsdaten vom Server...");
            return;
        }

        const storedDataRaw = sessionStorage.getItem('swtJsonData');
        const storedData = storedDataRaw ? JSON.parse(storedDataRaw) : {};

        if (!storedData.lastModified || storedData.lastModified !== config.lastModified) {
            console.log(`Neue Daten erkannt. Lade SWT-Datei...`);
            
            try {
                const response = await fetch(config.swtUrl);
                if (!response.ok) throw new Error(`SWT-Datei konnte nicht geladen werden: ${response.statusText}`);
                const swtArrayBuffer = await response.arrayBuffer();
                
                const dataView = new DataView(swtArrayBuffer);
                const rawSwtData = parseDataView(dataView);
                const cleanJson = convertSwtToJson(rawSwtData);

                sessionStorage.setItem('swtJsonData', JSON.stringify({
                    lastModified: config.lastModified,
                    jsonData: cleanJson
                }));
                
                setupDisplay(cleanJson, config.params);

            } catch(error) {
                console.error("Fehler beim Herunterladen oder Verarbeiten der SWT-Datei:", error);
            }
        } else {
            // Auch wenn die Daten gleich sind, könnten sich die Anzeigeparameter geändert haben.
            // Daher wird setupDisplay trotzdem aufgerufen, aber mit den bereits gespeicherten Daten.
            setupDisplay(storedData.jsonData, config.params);
        }
    }

    /**
     * Event-Listener für den manuellen Dateiupload (Fallback-Modus).
     */
    fileInput.addEventListener('change', (event) => {
        // Diese Funktion bleibt unverändert...
        const file = event.target.files[0];
        if (!file) { return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;
                const dataView = new DataView(arrayBuffer);
                const rawSwtData = parseDataView(dataView);
                const cleanJson = convertSwtToJson(rawSwtData);
                sessionStorage.setItem('swtJsonData', JSON.stringify({
                    lastModified: `manual-${Date.now()}`,
                    jsonData: cleanJson
                }));
                setupDisplay(cleanJson);
            } catch (error) {
                console.error("Fehler beim Verarbeiten der SWT-Datei:", error);
                alert("Die Datei konnte nicht verarbeitet werden.");
            }
        };
        reader.readAsArrayBuffer(file);
    });
    
    /**
     * Baut die gesamte Anzeige auf, gesteuert durch API- und URL-Parameter.
     * @param {object} data Das saubere JSON-Objekt aus swt2jsonConverter.js.
     * @param {object} apiParams Optionale Parameter von der API.
     */
    function setupDisplay(data, apiParams = {}) {
        // --- NEUE PARAMETER-LOGIK ---

        // 1. "show"-Parameter prüfen (nur via API)
        if (apiParams.show === 0) {
            uploadSection.classList.add('hidden');
            displaySection.classList.add('hidden');
            comingSoonSection.classList.remove('hidden');
            if (paginationInterval) clearInterval(paginationInterval); // Timer stoppen
            return;
        } else {
            comingSoonSection.classList.add('hidden');
        }

        if (!data || !data.roundPairings || data.roundPairings.length === 0) return;
        
        tournamentNameEl.textContent = data.tournamentInfo.name;
        
        // 2. Runde bestimmen (Priorität: API > URL > Letzte Runde)
        let roundParam = apiParams.round !== undefined ? apiParams.round : parseInt(params.get('nrRound'), 10);
        let roundNumber = (roundParam > 0) ? roundParam : data.roundPairings.length;
        if (roundNumber < 1 || roundNumber > data.roundPairings.length) roundNumber = data.roundPairings.length;

        const roundData = data.roundPairings[roundNumber - 1];
        if (!roundData) { console.error(`Runde ${roundNumber} nicht gefunden.`); return; }
        allPairings = roundData.pairings;
        roundTitleEl.textContent = `Paarungen Runde ${roundData.round}`;

        allPairings.sort((a, b) => a.board - b.board);

        totalPages = Math.ceil(allPairings.length / pageSize);
        
        // 3. Startseite bestimmen (Priorität: API > URL > Seite 1)
        let pageParam = apiParams.page !== undefined ? apiParams.page : parseInt(params.get('nrPage'), 10);
        let startPage = (pageParam > 0) ? pageParam : 1;
        currentPage = (startPage >= 1 && startPage <= totalPages) ? startPage - 1 : 0;

        if (paginationInterval) clearInterval(paginationInterval);

        showCurrentPage();

        // 4. Intervall für Seitenwechsel bestimmen (Priorität: API > URL > 30s)
        let intervalTimeMs = 30 * 1000; // Default
        if (apiParams.seitenwechsel === 0) {
            intervalTimeMs = 0; // API deaktiviert Paging
        } else if (apiParams.seitenwechsel === 1 || apiParams.seitenwechsel === undefined) {
            // Paging ist via API aktiv oder nicht definiert, URL-Parameter kann überschreiben
            const urlInterval = params.get('interval');
            if (urlInterval !== null) {
                const intervalSeconds = parseInt(urlInterval, 10);
                if (intervalSeconds === 0) {
                    intervalTimeMs = 0;
                } else if (!isNaN(intervalSeconds) && intervalSeconds >= 5) {
                    intervalTimeMs = intervalSeconds * 1000;
                }
            }
        }

        if (totalPages > 1 && intervalTimeMs > 0) {
            paginationInterval = setInterval(nextPage, intervalTimeMs);
        }
        
        renderLegend();
        uploadSection.classList.add('hidden');
        displaySection.classList.remove('hidden');
    }

    // --- Die restlichen Funktionen bleiben unverändert ---

    function showCurrentPage() {
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        const pairingsForPage = allPairings.slice(startIndex, endIndex);
        const midpoint = Math.ceil(pairingsForPage.length / 2);
        const firstHalf = pairingsForPage.slice(0, midpoint);
        const secondHalf = pairingsForPage.slice(midpoint);
        const targetRowCount = pageSize / 2;

        tablesContainerEl.innerHTML = '';
        tablesContainerEl.appendChild(createTableForPairings(firstHalf, targetRowCount));
        tablesContainerEl.appendChild(createTableForPairings(secondHalf, targetRowCount));
        
        if (totalPages > 1) {
            paginationInfoEl.textContent = `Seite ${currentPage + 1} von ${totalPages}`;
        } else {
            paginationInfoEl.textContent = '';
        }
    }
    
    function nextPage() {
        currentPage++;
        if (currentPage >= totalPages) currentPage = 0;
        showCurrentPage();
    }
    
    function renderLegend() {
        legendEl.innerHTML = '';
        for (const range in colorScheme) {
            const item = colorScheme[range];
            const legendSpan = document.createElement('span');
            legendSpan.className = `legend-item ${item.class}`;
            legendSpan.textContent = range;
            legendEl.appendChild(legendSpan);
        }
    }
    
    function createTableForPairings(pairingsArray, targetRowCount) {
        const table = document.createElement('table');
        table.className = 'pairing-table';
        table.innerHTML = `<thead><tr><th>Brett</th><th>Weiß</th><th>Schwarz</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        
        pairingsArray.forEach(p => {
            const row = document.createElement('tr');
            const whitePlayerStyle = getPlayerStyling(p.white.name);
            const blackPlayerStyle = getPlayerStyling(p.black.name);
            row.innerHTML = `<td>${p.board}</td><td class="player-cell ${whitePlayerStyle.class}">${p.white.name}</td><td class="player-cell ${blackPlayerStyle.class}">${p.black.name}</td>`;
            tbody.appendChild(row);
        });

        for (let i = pairingsArray.length; i < targetRowCount; i++) {
            const placeholderRow = document.createElement('tr');
            placeholderRow.className = 'placeholder-row';
            placeholderRow.innerHTML = `<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>`;
            tbody.appendChild(placeholderRow);
        }
        
        table.appendChild(tbody);
        return table;
    }

    function getPlayerStyling(playerName) {
        const nameParts = playerName.split(',');
        const lastName = nameParts[0];
        const firstLetter = lastName.charAt(0).toUpperCase();

        for (const range in colorScheme) {
            const [start, end] = range.split('-');
            if (firstLetter.localeCompare(start, 'de', { sensitivity: 'base' }) >= 0 && firstLetter.localeCompare(end, 'de', { sensitivity: 'base' }) <= 0) {
                return colorScheme[range];
            }
        }
        return { class: '' };
    }
});

