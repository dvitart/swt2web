/**
 * Dieses Modul ist für den regelmäßigen Abruf von Gerätekonfigurationen zuständig.
 * Es stellt ein globales Objekt `TournamentFetcher` zur Verfügung.
 */
const TournamentFetcher = (() => {
    let pollingIntervalId = null;
    let deviceConfigStore = {}; // Umbenannt für mehr Klarheit

    /**
     * Holt die Konfigurationsdaten, sucht nach der spezifischen deviceId
     * und speichert die relevanten Turnier-Infos (swtUrl, lastModified).
     * @param {string} deviceId - Die ID des Geräts.
     */
    async function fetchDeviceConfig(deviceId) {
        const baseUrl = 'https://anmeldung-sjsh.de/seite2/ajax/tournament_display.html';
        const url = `${baseUrl}?id=${deviceId}`;
        
        console.log(`Rufe Konfiguration für deviceId ab: ${deviceId}...`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            }

            const data = await response.json();
            
            // NEU: Suche nach dem Schlüssel, der der deviceId entspricht
            if (data && data[deviceId]) {
                const deviceData = data[deviceId];
                
                // Speichere nur die benötigten Informationen
                deviceConfigStore = {
                    lastFetch: new Date().toISOString(),
                    swtUrl: deviceData.swtUrl,
                    lastModified: deviceData.lastModified,
                    params: deviceData.params,
                    error: null
                };
                console.log('Konfiguration erfolgreich extrahiert:', deviceConfigStore);
            } else {
                throw new Error(`DeviceId '${deviceId}' nicht in der API-Antwort gefunden.`);
            }

        } catch (error) {
            console.error('Fehler beim Abrufen der Gerätekonfiguration:', error);
            deviceConfigStore.error = {
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Startet das regelmäßige Abrufen der Konfiguration.
     * @param {string} deviceId - Die ID des Geräts.
     * @param {number} [intervalMilliseconds=30000] - Das Abrufintervall.
     */
    function startPolling(deviceId, intervalMilliseconds = 30000) {
        if (!deviceId) {
            console.error('Eine deviceId ist erforderlich, um das Polling zu starten.');
            return;
        }
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
        }
        console.log(`Polling für deviceId '${deviceId}' gestartet (Intervall: ${intervalMilliseconds / 1000}s).`);
        fetchDeviceConfig(deviceId); // Sofortiger erster Abruf
        pollingIntervalId = setInterval(() => fetchDeviceConfig(deviceId), intervalMilliseconds);
    }

    function stopPolling() {
        if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
            console.log('Polling gestoppt.');
        }
    }

    /**
     * Gibt die zuletzt abgerufene Konfiguration zurück.
     */
    function getConfig() {
        return deviceConfigStore;
    }

    return {
        start: startPolling,
        stop: stopPolling,
        getConfig: getConfig // Umbenannt von getData
    };
})();