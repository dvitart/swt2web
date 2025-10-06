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
    const pageSize = 50; // 2 Spalten * 25 Bretter
    let totalPages = 0;
    let allPairings = [];
    let paginationInterval = null;

    const colorScheme = {
        'A-F': { class: 'color-group-a' },
        'G-L': { class: 'color-group-b' },
        'M-R': { class: 'color-group-c' },
        'S-Z': { class: 'color-group-d' },
    };

    // Event Listener für den Datei-Upload
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
                setupDisplay(cleanJson);
            } catch (error) {
                console.error("Fehler beim Verarbeiten der SWT-Datei:", error);
                alert("Die Datei konnte nicht verarbeitet werden.");
            }
        };
        reader.readAsArrayBuffer(file);
    });
    
    function setupDisplay(data) {
        if (!data || !data.roundPairings || data.roundPairings.length === 0) {
            alert("Die Datei enthält keine gültigen Runden-Daten.");
            return;
        }

        const params = new URLSearchParams(window.location.search);
        let roundNumber = parseInt(params.get('nrRound'), 10);
        if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > data.roundPairings.length) {
            roundNumber = data.roundPairings.length;
        }

        const roundData = data.roundPairings[roundNumber - 1];
        if (!roundData) {
            alert(`Runde ${roundNumber} wurde nicht gefunden.`);
            return;
        }

        tournamentNameEl.textContent = data.tournamentInfo.name;
        roundTitleEl.textContent = `Paarungen Runde ${roundData.round}`;

        allPairings = roundData.pairings;
        totalPages = Math.ceil(allPairings.length / pageSize);
        currentPage = 0;

        if (paginationInterval) {
            clearInterval(paginationInterval);
        }

        showCurrentPage();

        if (totalPages > 1) {
            paginationInterval = setInterval(nextPage, 30000);
        }
        
        renderLegend();
        uploadSection.classList.add('hidden');
        displaySection.classList.remove('hidden');
    }

    function showCurrentPage() {
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        const pairingsForPage = allPairings.slice(startIndex, endIndex);

        const midpoint = Math.ceil(pairingsForPage.length / 2);
        const firstHalf = pairingsForPage.slice(0, midpoint);
        const secondHalf = pairingsForPage.slice(midpoint);

        const targetRowCount = pageSize / 2; // Jede Spalte soll 25 Zeilen hoch sein

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
        if (currentPage >= totalPages) {
            currentPage = 0;
        }
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
    
    /**
     * Erstellt eine Tabelle und füllt sie mit Platzhaltern auf eine Zielhöhe auf.
     * @param {Array} pairingsArray Die anzuzeigenden Paarungen.
     * @param {number} targetRowCount Die Zielanzahl der Zeilen (z.B. 25).
     */
    function createTableForPairings(pairingsArray, targetRowCount) {
        const table = document.createElement('table');
        table.className = 'pairing-table';
        table.innerHTML = `<thead><tr><th>Brett</th><th>Weiß</th><th>Schwarz</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        
        // Echte Paarungs-Zeilen einfügen
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

        // VERBESSERT: Unsichtbare Platzhalter-Zeilen für stabile Höhe einfügen
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

    function getPlayerStyling(playerName) {
        const nameParts = playerName.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        const firstLetter = lastName.charAt(0).toUpperCase();

        for (const range in colorScheme) {
            const [start, end] = range.split('-');
            if (firstLetter.localeCompare(start) >= 0 && firstLetter.localeCompare(end) <= 0) {
                return colorScheme[range];
            }
        }
        return { class: '' };
    }
});