/**
 * Konvertiert rohe SWT-JSON-Daten in eine saubere, menschenlesbare Struktur.
 * @param {object} swtData Das originale JSON-Objekt aus swtparser.js.
 * @returns {object} Ein strukturiertes Objekt mit tournamentInfo, playerList und roundPairings.
 */
function convertSwtToJson(swtData) {

  // Hilfsfunktionen zur Konvertierung von Codes
  const getColor = (colorCode) => (colorCode === "4000-1" ? "white" : "black");

  const getResult = (resultCode, color) => {
    const isWhite = color === "white";
    switch (resultCode) {
      case "4002-3": // Sieg
        return isWhite ? "1-0" : "0-1";
      case "4002-2": // Remis
        return "1/2-1/2";
      case "4002-1": // Niederlage
        return isWhite ? "0-1" : "1-0";
      default:
        return "-"; // Für unbekannte Ergebnisse oder Forfait
    }
  };
  
  // Ein Mapping, um Spieler über ihre Startnummer (als String) zu finden
  const playerStartIdMap = new Map(swtData.players.map(p => [p['2020'], p]));


  // 1. Turnierinformationen transformieren
  const transformGeneralInfo = (general) => ({
    name: general['65'],
    location: general['66'],
    organizer: general['88'],
    arbiter: general['67'],
    dates: {
      start: new Date(general['89']).toISOString().split('T')[0],
      end: new Date(general['91']).toISOString().split('T')[0],
    },
    timeControl: `${general['72']} + ${general['73']}`,
    totalRounds: general['1'],
    playerCount: general['4'],
  });

  // 2. Spiele für einen einzelnen Spieler aus den Paarungsdaten extrahieren
  const getPlayerGames = (playerId, allPairings) => {
    const playerGames = allPairings.filter(p => p.player === playerId);
    return playerGames.map(game => {
      const opponentStartId = game['4001'];
      const opponent = playerStartIdMap.get(opponentStartId);
      const color = getColor(game['4000']);

      return {
        round: game.round,
        opponentId: opponent ? parseInt(opponent['2021'], 10) : null,
        opponentName: opponent ? opponent['2000'] : 'spielfrei',
        result: getResult(game['4002'], color),
        color: color,
      };
    }).sort((a, b) => a.round - b.round);
  };
  
  // 3. Spielerliste erstellen
  const transformPlayerList = (players, allPairings) => {
    return players.map(player => {
        // Ignoriere leere Einträge, falls vorhanden
        if (!player['2000'] || player['2000'].trim() === '') {
            return null;
        }
        
        const playerId = player['2020']; // '1', 'a', 'b', etc.
        const playerIdNum = parseInt(player['2021'], 10);

        return {
            id: playerIdNum,
            startRank: playerIdNum,
            finalRank: parseInt(player['2022'], 10),
            name: player['2000'],
            title: player['2002'] || null,
            club: player['2001'],
            federation: player['2006'],
            rating: {
                national: parseInt(player['2003'], 10) || null,
                fide: parseInt(player['2004'], 10) || null,
            },
            points: parseFloat(player['2025']),
            tiebreaks: {
                buchholz: parseFloat(player['2030']),
                buchholzCut1: parseFloat(player['2031']),
                sonnebornBerger: parseFloat(player['2032']),
            },
            games: getPlayerGames(playerId, allPairings),
        };
    }).filter(Boolean); // Entfernt null-Einträge aus der Liste
  };

  // 4. Rundenpaarungen erstellen
  const transformRoundPairings = (allPairings, players) => {
      const rounds = {};
      const playerMap = new Map(players.map(p => [p['2020'], { id: p['2021'], name: p['2000']}]))

      allPairings.forEach(pairing => {
          // Verarbeite jede Paarung nur einmal (aus Sicht des Weißspielers), um Duplikate zu vermeiden
          if (pairing['4000'] !== '4000-1') {
              return;
          }

          const roundNum = pairing.round;
          if (!rounds[roundNum]) {
              rounds[roundNum] = { round: roundNum, pairings: [] };
          }
          
          const whitePlayer = playerMap.get(pairing.player);
          const blackPlayer = playerMap.get(pairing['4001']);
          
          if (!whitePlayer || !blackPlayer) return;

          rounds[roundNum].pairings.push({
              board: rounds[roundNum].pairings.length + 1,
              white: { id: whitePlayer.id, name: whitePlayer.name },
              black: { id: blackPlayer.id, name: blackPlayer.name },
              result: getResult(pairing['4002'], 'white'),
          });
      });

      // Konvertiere das Runden-Objekt in ein sortiertes Array
      return Object.values(rounds).sort((a,b) => a.round - b.round);
  };
  
  
  // Alles zusammenfügen
  const tournamentInfo = transformGeneralInfo(swtData.general);
  const playerList = transformPlayerList(swtData.players, swtData.pairings_players);
  const roundPairings = transformRoundPairings(swtData.pairings_players, swtData.players);

  return {
    tournamentInfo,
    playerList,
    roundPairings,
  };
}


// --- Beispiel für die Verwendung ---

// Angenommen, 'originalSwtData' ist das geladene JSON-Objekt aus deiner Datei swtData.json
// const originalSwtData = { ... }; // Lade hier deine JSON-Datei

// const formattedData = convertSwtToJson(originalSwtData);
// console.log(JSON.stringify(formattedData, null, 2));