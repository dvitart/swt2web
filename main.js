document.addEventListener('DOMContentLoaded', () => {
    // DOM-Elemente
    const fileInput = document.getElementById('swt-file-input');
    const uploadSection = document.getElementById('upload-section');
    const displaySection = document.getElementById('display-section');
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
        // Modus 1: API-Polling bei vorhandener deviceId
        uploadSection.classList.add('hidden');
        console.log(`Geräte-ID '${deviceId}' gefunden. Starte API-Polling.`);
        TournamentFetcher.start(deviceId, 20000); // Konfiguration alle 20s abrufen
        setInterval(checkForUpdates, 5000); // Alle 5s prüfen, ob ein Update nötig ist
        checkForUpdates(); // Sofortiger erster Check

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
     * Kernfunktion im API-Modus: Prüft, ob die SWT-Datei auf dem Server neuer ist als die lokal gespeicherte.
     * Wenn ja, wird sie heruntergeladen, verarbeitet und die Anzeige aktualisiert.
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
            console.log(`Neue Daten erkannt (API: ${config.lastModified}, Lokal: ${storedData.lastModified || 'N/A'}). Lade SWT-Datei...`);
            
            try {
                // SWT-Datei von der in der Konfiguration angegebenen URL laden
                const response = await fetch(config.swtUrl);
                if (!response.ok) throw new Error(`SWT-Datei konnte nicht geladen werden: ${response.statusText}`);
                const swtArrayBuffer = await response.arrayBuffer();
                
                // SWT-Datei parsen und in sauberes JSON umwandeln
                const dataView = new DataView(swtArrayBuffer);
                const rawSwtData = parseDataView(dataView);
                const cleanJson = convertSwtToJson(rawSwtData);

                // Das neue, saubere JSON zusammen mit dem Zeitstempel im sessionStorage speichern
                sessionStorage.setItem('swtJsonData', JSON.stringify({
                    lastModified: config.lastModified,
                    jsonData: cleanJson
                }));
                
                // Die Anzeige mit den frischen Daten aufbauen
                setupDisplay(cleanJson, config.params);

            } catch(error) {
                console.error("Fehler beim Herunterladen oder Verarbeiten der SWT-Datei:", error);
            }
        }
    }

    /**
     * Event-Listener für den manuellen Dateiupload (Fallback-Modus).
     */
    fileInput.addEventListener('change', (event) => {
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
                    lastModified: `manual-${Date.now()}`, // Eindeutiger Zeitstempel für manuelle Uploads
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
     * Baut die gesamte Anzeige (Tabellen, Legende, Paginierung) basierend auf den Turnierdaten auf.
     * @param {object} data Das saubere JSON-Objekt aus swt2jsonConverter.js.
     * @param {object} apiParams Optionale Parameter von der API (z.B. für Runden-Vorauswahl).
     */
    function setupDisplay(data, apiParams = {}) {
        if (!data || !data.roundPairings || data.roundPairings.length === 0) {
            // Zeigt keine Fehlermeldung, um bei leeren Turnieren nicht zu stören
            return;
        }
        
        tournamentNameEl.textContent = data.tournamentInfo.name;
        const params = new URLSearchParams(window.location.search);
        
        // Runde: URL-Parameter hat Vorrang, dann API-Parameter, dann letzte Runde
        let roundNumber = parseInt(params.get('nrRound'), 10) || apiParams.round || data.roundPairings.length;
        if (roundNumber < 1 || roundNumber > data.roundPairings.length) {
            roundNumber = data.roundPairings.length;
        }

        const roundData = data.roundPairings[roundNumber - 1];
        if (!roundData) {
            console.error(`Runde ${roundNumber} wurde nicht gefunden.`);
            return;
        }
        allPairings = roundData.pairings;
        roundTitleEl.textContent = `Paarungen Runde ${roundData.round}`;

        allPairings.sort((a, b) => a.board - b.board);

        totalPages = Math.ceil(allPairings.length / pageSize);
        
        // Startseite: URL-Parameter hat Vorrang, dann API-Parameter, dann Seite 1
        const pageParam = parseInt(params.get('nrPage'), 10) || apiParams.page || 1;
        if (pageParam >= 1 && pageParam <= totalPages) {
            currentPage = pageParam - 1;
        } else {
            currentPage = 0;
        }

        if (paginationInterval) {
            clearInterval(paginationInterval);
        }

        showCurrentPage(); // Zeigt die Startseite sofort an

        // Intervall: URL-Parameter hat Vorrang, dann API-Parameter, dann 30s
        const intervalParam = params.get('interval') !== null ? parseInt(params.get('interval'), 10) : (apiParams.seitenwechsel !== undefined ? apiParams.seitenwechsel : 30);
        let intervalTimeMs = 30 * 1000;
        if (intervalParam === 0) {
            intervalTimeMs = 0;
        } else if (!isNaN(intervalParam) && intervalParam >= 5) {
            intervalTimeMs = intervalParam * 1000;
        }

        if (totalPages > 1 && intervalTimeMs > 0) {
            paginationInterval = setInterval(nextPage, intervalTimeMs);
        }
        
        renderLegend();
        uploadSection.classList.add('hidden');
        displaySection.classList.remove('hidden');
    }

    /**
     * Zeigt die Tabellen für die aktuell ausgewählte Seite an.
     */
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
    
    /**
     * Wechselt zur nächsten Seite oder startet von vorn.
     */
    function nextPage() {
        currentPage++;
        if (currentPage >= totalPages) {
            currentPage = 0;
        }
        showCurrentPage();
    }
    
    /**
     * Generiert die Farblegende am unteren Rand.
     */
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
    
    /**
     * Erstellt eine einzelne HTML-Tabelle und füllt sie ggf. mit leeren Zeilen auf.
     * @param {Array} pairingsArray - Die Paarungen für diese Tabelle.
     * @param {number} targetRowCount - Die gewünschte Anzahl an Zeilen.
     * @returns {HTMLTableElement} Das fertige Tabellenelement.
     */
    function createTableForPairings(pairingsArray, targetRowCount) {
        const table = document.createElement('table');
        table.className = 'pairing-table';
        table.innerHTML = `<thead><tr><th>Brett</th><th>Weiß</th><th>Schwarz</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        
        pairingsArray.forEach(p => {
            const row = document.createElement('tr');
            const whitePlayerStyle = getPlayerStyling(p.white.name);
            const blackPlayerStyle = getPlayerStyling(p.black.name);
            row.innerHTML = `
                <td>${p.board}</td>
                <td class="player-cell ${whitePlayerStyle.class}">${p.white.name}</td>
                <td class="player-cell ${blackPlayerStyle.class}">${p.black.name}</td>
            `;
            tbody.appendChild(row);
        });

        const actualRowCount = pairingsArray.length;
        if (actualRowCount < targetRowCount) {
            for (let i = actualRowCount; i < targetRowCount; i++) {
                const placeholderRow = document.createElement('tr');
                placeholderRow.className = 'placeholder-row';
                placeholderRow.innerHTML = `<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>`;
                tbody.appendChild(placeholderRow);
            }
        }
        
        table.appendChild(tbody);
        return table;
    }

    /**
     * Ermittelt die CSS-Klasse für einen Spielernamen basierend auf dem Nachnamen.
     * @param {string} playerName - Der volle Name des Spielers.
     * @returns {object} Ein Objekt mit der CSS-Klasse.
     */
    function getPlayerStyling(playerName) {
        const nameParts = playerName.split(' ');
        const lastName = nameParts[nameParts.length - 1];
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
