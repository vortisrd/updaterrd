let streamerBotClient = null
let streamerBotConnected = false;

/* -------------------------
   Salvar configurações no localStorage
-------------------------- */

function saveStreamerBotSettings() {
    return new Promise((resolve) => {
        const inputs = document.querySelectorAll('input[type="text"][name]:not(.refused)');
        const settings = {};

        inputs.forEach(input => {
            settings[input.name] = input.value;
        });

        localStorage.setItem("UpdaterRDSettings", JSON.stringify(settings));

        resolve(); // Finaliza a Promise
    });
}

async function loadStreamerBotSettings() {
    return new Promise((resolve) => {
        const saved = localStorage.getItem("UpdaterRDSettings");
        if (!saved) {
            resolve();
            return;
        }

        const settings = JSON.parse(saved);

        Object.keys(settings).forEach(key => {
            const input = document.querySelector(`input[type="text"][name="${key}"]`);
            if (input) {
                input.value = settings[key];
            }
        });

        resolve();
    });
}

function enableAutoSaveStreamerBotSettings() {
    const inputs = document.querySelectorAll('input[type="text"][name]');

    inputs.forEach(input => {
        input.addEventListener("input", () => {
            saveStreamerBotSettings().then(() => {
                if (
                    input.name === "streamerBotServerAddress" ||
                    input.name === "streamerBotServerPort"
                ) {
                    streamerBotConnect();
                }
            });
        });
    });
}


function activateTabs() {
    const tabs = document.querySelectorAll(".tabs button");
    const platforms = document.querySelectorAll(".platform[id]");

    // Garante que não disparem submit se estiverem dentro de um <form>
    tabs.forEach(btn => btn.setAttribute("type", "button"));

    function showPlatform(id) {
        // troca classes nas plataformas
        platforms.forEach(p => p.classList.remove("active"));
        const target = document.getElementById(id);
        if (target) target.classList.add("active");
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", (e) => {
            // evita submit e cliques "borbulhando" num form/pai
            e.preventDefault();
            e.stopPropagation();
        
            // troca classes nos botões
            tabs.forEach(btn => btn.classList.remove("active"));
            tab.classList.add("active");
        
            // mostra a plataforma correspondente (id = tab-XXXX -> XXXX)
            const selectedId = tab.id.replace("tab-", "");
            showPlatform(selectedId);
        });
    });

    // inicia abrindo a aba marcada como .active no HTML, ou a primeira
    const initial = document.querySelector(".tabs button.active") || tabs[0];
    if (initial) initial.click();
}


function sendStreamInfo() {
    const inputs = document.querySelectorAll('input[type="text"][name]:not(.avoid)');
    const settings = {};

    inputs.forEach(input => {
        settings[input.name] = input.value;
    });

    console.log(`settings`, settings);

    streamerBotClient.doAction(
    { name : "[UpdaterRD] Updater" },
    {
        "message": JSON.stringify(settings),
    }
    ).then( (updaterinfo) => {
        console.debug('[UpdaterRD] Sending Stream Info to Streamer.Bot', updaterinfo);
    });


    const button = document.getElementById("streamupdate");
    const defaultButtonValue = button.textContent;

    button.textContent = 'Streams Updated!';
    button.style.backgroundColor = "#00dd63";

    setTimeout(() => {
        button.textContent = defaultButtonValue;
        button.removeAttribute('style');
    }, 3000);
}


function addYouTubeBroadcast(data) {
    const id = data.id;
    const title = data.title;

    const container = document.getElementById("youtubestreams");

    if (container.querySelector(`#youtubestream-${id}`)) return;    
    if (container.querySelector("#youtubestreams-empty")) { container.innerHTML = ''; }
    var html = `
        <div id="youtubestream-${id}" class="config rows">
            <label>Title 👉 <a href="https://youtu.be/${id}" target="_blank" title="${title}"><i class="fa-brands fa-youtube"></i></a></label>
            <input type="text" name="youtubeStreamTitle[${id}]" value="${title}" placeholder="Enter a Title">
        </div>
    `;

    container.insertAdjacentHTML("beforeend", html);
}

function removeYouTubeBroadcast(data) {
    const id = data.id;

    const container = document.getElementById("youtubestreams");
    
    container.querySelector(`#youtubestream-${id}`)?.remove();

    if (container.innerHTML.trim() === '') {
        var html = `
            <div id="youtubestreams-empty" class="config">
                <small class="warning">
                    <i class="fa-solid fa-warning"></i> You need to start a YouTube stream first for the title to be updated.
                </small>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    }
}




/* -------------------------
   Conexão com Streamer.bot
-------------------------- */
function streamerBotConnect() {
    const streamerBotStatus = document.getElementById('streamerBotStatus');

    const streamerBotServerAddress = document.querySelector('input[type=text][name=streamerBotServerAddress]').value;
    const streamerBotServerPort = document.querySelector('input[type=text][name=streamerBotServerPort]').value;

    if (streamerBotClient) {
        try {
            console.debug("[UpdaterRD][Settings] Closing previous Streamer.bot connection...");
            streamerBotClient.disconnect?.(); // usa se existir
            streamerBotClient = null;
        } catch (err) {
            console.error("[UpdaterRD][Settings] Error closing previous client:", err);
        }
    }

    streamerBotClient = new StreamerbotClient({
        host: streamerBotServerAddress,
        port: streamerBotServerPort,
        onConnect: () => {
            console.debug(`[UpdaterRD][Settings] Connected to Streamer.bot successfully!`);
            streamerBotConnected = true;
            streamerBotStatus.classList.add('connected');
            streamerBotStatus.querySelector('small').textContent = `Connected`;


            const youtubeMessageHandlers = {
                /*'YouTube.BroadcastStarted': (response) => {
                    addYouTubeBroadcast(response.data);
                },*/
                'YouTube.BroadcastUpdated': (response) => {
                    if (response.data.status === 'live') {
                        addYouTubeBroadcast(response.data);
                    }
                    else if (response.data.status === 'complete') {
                        removeYouTubeBroadcast(response.data);
                    }
                },
                'General.Custom': (response) => {
                    if (
                        response.data.action === 'UpdaterRDYouTubeStreams'
                        &&
                        response.data.data.length > 0
                    ) {

                        response.data.data.forEach(element => {
                            addYouTubeBroadcast(element);    
                        });
                    }
                },
                /*'YouTube.BroadcastEnded': (response) => {
                    removeYouTubeBroadcast(response.data);
                }*/
            };

            registerPlatformHandlersToStreamerBot(youtubeMessageHandlers, '[UpdaterRD]');


            streamerBotClient.doAction(
            { name : "[UpdaterRD] YouTube Streams Fetcher" }
            ).then( (updaterinfo) => {
                console.debug('[UpdaterRD] Getting YouTube Streams', updaterinfo);
            });

        },
        onDisconnect: () => {
            streamerBotStatus.classList.remove('connected');
            streamerBotStatus.querySelector('small').textContent = `Awaiting for connection`;
            streamerBotConnected = false;
            console.debug(`[UpdaterRD][Settings] Streamer.bot Disconnected!`);
        }
    });
}


function registerPlatformHandlersToStreamerBot(handlers, logPrefix = '') {
    for (const [event, handler] of Object.entries(handlers)) {
        streamerBotClient.on(event, (...args) => {
            if (logPrefix) {
                console.debug(`${logPrefix} ${event}`, args[0]);
            }
            handler(...args);
        });
    }
}


/* -------------------------
   Inicialização
-------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    activateTabs();
    loadStreamerBotSettings().then(() => { streamerBotConnect(); });
    enableAutoSaveStreamerBotSettings();

    document.getElementById("streamupdate").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        sendStreamInfo();
    });
});