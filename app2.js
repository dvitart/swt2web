document.addEventListener('DOMContentLoaded', () => {
    // --- KONFIGURATION ---
    const PAIRINGS_PER_PAGE = 20;
    const STANDINGS_ROWS_PER_PAGE = 25;
    const GROUP_SIZE = 10;
    const PAGE_SWITCH_INTERVAL = 15000;

    // --- DOM-Elemente ---
    const fileInput = document.getElementById('swt-file-input');
    const pairingBoard = document.getElementById('pairing-board');
    const tournamentNameEl = document.getElementById('tournament-name');
    const roundInfoEl = document.getElementById('round-info');
    const paginationInfoEl = document.getElementById('pagination-info');

    let tournamentData = null;
    let pageInterval;

    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            showPairings: params.get('showPairings') === 'true',
            showResults: params.get('showResults') === 'true',
            nrRound: params.get('nrRound') ? parseInt(params.get('nrRound'), 10) : null,
            displayArt: params.get('displayArt') || 'monitor'
        };
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            const dataView = new DataView(arrayBuffer);
            try {
                const rawSwtData = parseDataView(dataView);
                tournamentData = convertSwtToJson(rawSwtData);
                sessionStorage.setItem('tournamentData', JSON.stringify(tournamentData));
                startDisplay();
            } catch (error) {
                console.error("Fehler beim Verarbeiten der SWT-Datei:", error);
                alert("Die SWT-Datei konnte nicht verarbeitet werden.");
            }
        };
        reader.readAsArrayBuffer(file);
    });

    function startDisplay() {
        if (!tournamentData) return;
        const params = getUrlParams();
        document.body.className = `display-${params.displayArt}`;
        tournamentNameEl.textContent = tournamentData.tournamentInfo.name;
        if (pageInterval) clearInterval(pageInterval);
        if (params.showResults) {
            renderStandings(params);
        } else {
            renderPairings(params);
        }
    }

    function renderPairings(params) {
        const roundToShow = params.nrRound || tournamentData.tournamentInfo.totalRounds;
        const roundData = tournamentData.roundPairings.find(r => r.round === roundToShow);
        
        if (!roundData || roundData.pairings.length === 0) {
            pairingBoard.innerHTML = `<p class="error-message">Keine Paarungen für Runde ${roundToShow} gefunden.</p>`;
            roundInfoEl.textContent = `Paarungen Runde ${roundToShow}`;
            paginationInfoEl.textContent = '';
            return;
        }

        const pairings = roundData.pairings;
        const totalPages = Math.ceil(pairings.length / PAIRINGS_PER_PAGE);
        let currentPage = 1;

        // FIX: Die korrekte Rundennummer 'roundToShow' wird an die Anzeigefunktion übergeben.
        const show = () => showPairingsPage(pairings, currentPage, totalPages, roundToShow);
        show();

        if (params.displayArt === 'monitor' && totalPages > 1) {
            pageInterval = setInterval(() => {
                currentPage = (currentPage % totalPages) + 1;
                show();
            }, PAGE_SWITCH_INTERVAL);
        }
    }

    // FIX: Die Funktion akzeptiert jetzt die 'roundNumber'.
    function showPairingsPage(pairings, pageNum, totalPages, roundNumber) {
        const start = (pageNum - 1) * PAIRINGS_PER_PAGE;
        const end = start + PAIRINGS_PER_PAGE;
        const pagePairings = pairings.slice(start, end);
        const groups = {};
        pagePairings.forEach(p => {
            const groupIndex = Math.floor((p.board - 1) / GROUP_SIZE);
            if (!groups[groupIndex]) groups[groupIndex] = [];
            groups[groupIndex].push(p);
        });
        pairingBoard.innerHTML = Object.values(groups).map(groupPairings => {
            const firstBoard = groupPairings[0].board;
            const lastBoard = groupPairings[groupPairings.length - 1].board;
            return `
                <div class="pairing-group">
                    <h3 class="group-title">Bretter ${firstBoard} - ${lastBoard}</h3>
                    <div class="card-grid">
                        ${groupPairings.map(createCardHTML).join('')}
                    </div>
                </div>`;
        }).join('');

        // FIX: Die korrekte 'roundNumber' wird für die Anzeige verwendet.
        roundInfoEl.textContent = `Paarungen Runde ${roundNumber}`;
        paginationInfoEl.textContent = `Zeige Bretter ${start + 1} - ${Math.min(end, pairings.length)} von ${pairings.length} | Seite ${pageNum} von ${totalPages}`;
    }
    
    function createCardHTML(pairing) {
        const formatPlayerLine = (player, color) => {
            if (!player || !player.name) {
                return `<div class="player-line"><span class="player-name">spielfrei</span></div>`;
            }
            const [lastName, firstName] = player.name.split(',').map(s => s.trim());
            const nameHTML = `<span class="player-name"><strong>${lastName}</strong>, ${firstName || ''}</span>`;
            
            return `
                <div class="player-line">
                    <span class="player-icon ${color}"></span>
                    ${nameHTML}
                </div>`;
        };

        const isFinished = pairing.result !== '-';
        
        return `
            <div class="card ${isFinished ? 'finished' : ''}">
                <div class="card-top-line">
                    <span class="board-number">${pairing.board}</span>
                    ${isFinished ? `<span class="result">${pairing.result}</span>` : ''}
                </div>
                ${formatPlayerLine(pairing.white, 'white')}
                ${formatPlayerLine(pairing.black, 'black')}
            </div>
        `;
    }

    // Ranglisten-Funktionen (unverändert)
    function renderStandings(params) { /* ... */ }
    function showStandingsPage(players, pageNum, totalPages) { /* ... */ }

    function initialize() {
        const storedData = sessionStorage.getItem('tournamentData');
        if (storedData) {
            tournamentData = JSON.parse(storedData);
            startDisplay();
        }
    }
    
    initialize();
});