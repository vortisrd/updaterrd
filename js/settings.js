const searchInputTwitch = document.getElementById("searchTwitch");
const searchInputKick = document.getElementById("searchKick");

const resultsContainerTwitch = document.getElementById("resultsTwitch");
const resultsContainerKick = document.getElementById("resultsKick");

const containerTwitch = document.getElementById("twitch");
const containerKick = document.getElementById("kick");

const cacheKey = "categoriesCache";
const cacheLimit = 20; // limite de 20 pesquisas
const cacheTTL = 6 * 60 * 60 * 1000; // 6 horas para expirar

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


/* -------------------------
   Limpa o Cache de Pesquisa
-------------------------- */

function cleanExpiredCache() {
    const cache = JSON.parse(localStorage.getItem(cacheKey)) || {};
    const now = Date.now();
    let changed = false;
      
    for (const key in cache) {
        if ((now - cache[key].timestamp) >= cacheTTL) {
            delete cache[key];
            changed = true;
        }
    }

    if (changed) { localStorage.setItem(cacheKey, JSON.stringify(cache)); }
}


/* -------------------------
   Cache de Pesquisa
-------------------------- */
async function fetchCategories(query) {
    let cache = JSON.parse(localStorage.getItem(cacheKey)) || {};
    const now = Date.now();
    // Verifica se existe no cache e não expirou
    if (cache[query] && (now - cache[query].timestamp) < cacheTTL) {
        return cache[query].data;
    }
    // Se não existir ou expirou → busca da API
    const response = await fetch(`https://twitch.justplayer.de/twitch/categories?query=${encodeURIComponent(query.replace(' ', '_'))}`);
    const data = await response.json();

    // Se já tiver 20 entradas, remove a mais antiga
    const keys = Object.keys(cache);
    if (keys.length >= cacheLimit) {
        // Ordena por timestamp e remove o mais antigo
        keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        delete cache[keys[0]];
    }
    // Salva no cache com timestamp
    cache[query] = {
        data: data,
        timestamp: now
    };

    localStorage.setItem(cacheKey, JSON.stringify(cache));
    return data;
}

/* -------------------------
   Mostra os resultados dos jogos
-------------------------- */
function showResults(categories, searchInput, resultsContainer) {
    resultsContainer.innerHTML = "";
    
    if (!categories.length) {
        resultsContainer.style.display = "none";
        return;
    }

    categories.forEach(cat => {
        const div = document.createElement("div");
        div.classList.add("result-item");

        const img = document.createElement("img");
        img.src = cat.box_art_url.replace("-52x72", "-100x140");

        const span = document.createElement("span");
        span.textContent = cat.name;

        div.appendChild(img);
        div.appendChild(span);

        div.addEventListener("click", () => {
            searchInput.value = cat.name;
            hideResults();
        });

        resultsContainer.appendChild(div);
    });
    resultsContainer.style.display = "block";
}

function hideResults() {
    resultsContainerTwitch.style.display = "none";
    resultsContainerKick.style.display = "none";
}

function setupSearchInput(inputElement, resultElement) {
    let timeout;

    inputElement.addEventListener("input", () => {
        clearTimeout(timeout);
        const query = inputElement.value.trim();

        if (query.length === 0) {
            hideResults();
            return;
        }

        timeout = setTimeout(async () => {
            const categories = await fetchCategories(query);
            showResults(categories, inputElement, resultElement);
        }, 500);
    });
}


function setupOutsideClick(container, resultsContainer) {
    document.addEventListener("click", (event) => {
        if (!container.contains(event.target)) {
            resultsContainer.style.display = "none"; // ou hideResults()
        }
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
    
    setupSearchInput(searchInputTwitch, resultsContainerTwitch);
    setupSearchInput(searchInputKick, resultsContainerKick);

    setupOutsideClick(containerTwitch, resultsContainerTwitch);
    setupOutsideClick(containerKick, resultsContainerKick);

    // Fecha ao apertar ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideResults();
        }
    });

});