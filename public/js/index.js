// Abrir o hambúrguer
function toggleNavbar() {
    var menu = document.getElementById('menu');
    var menuIcon = document.getElementById('menuIcon');
    menu.classList.toggle('open');
    menuIcon.classList.toggle('open');
}

// Criar o contêiner principal para os itens (dentro do #shop)
const container = document.createElement("div");
container.classList.add("item-container");

// Limpar o contêiner de itens
function cleanItems() {
    container.innerHTML = "";
}

// Copiar o comando de compra para a área de transferência
async function copyCommand(rowData) {
    var id = rowData[0],
        type,
        name = rowData[1],
        collection = await searchCollectionName(rowData[4]);

    if (id >= 100 && id < 200) type = "Cor";
    else if (id >= 200 && id < 300) type = "Emblema";
    else if (id >= 300 && id < 400) type = "Banner";
    else if (id >= 400 && id < 500) type = "Título";

    navigator.clipboard.writeText(`/item buy item:${type}: ${name} (${collection})`)
        .then(() => alert("Comando copiado para a área de transferência!"))
        .catch(error => console.error('Erro ao copiar o comando: ', error));
}

// Criar os elementos comuns dos itens
function createCommonElements(rowData, additionalElements, isBanner = false) {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("item");

    rowData.forEach(data => {
        if (typeof data === 'string' && data.includes('http')) {
            const imageElement = document.createElement("img");
            imageElement.src = data;
            imageElement.alt = data;
            imageElement.style.maxWidth = isBanner ? "100%" : "10%";
            imageElement.style.borderRadius = "10px";
            itemDiv.appendChild(imageElement);
        } else {
            const paragraph = document.createElement("p");
            paragraph.innerHTML = data;
            itemDiv.appendChild(paragraph);
        }
    });

    additionalElements.forEach(element => itemDiv.appendChild(element));

    return itemDiv;
}

// Variáveis globais
let currentData = [];
let currentUrl = '';
let currentMappingFunc = null;
let currentAdditionalElementsFunc = null;
let currentIsBanner = false;
let currentType = '';

// Atualizar o estado dos botões
function updateButtonsState(activeType) {
    const buttons = {
        cores: document.getElementById("btnColors"),
        banners: document.getElementById("btnBanners"),
        titulos: document.getElementById("btnTitles"),
        emblemas: document.getElementById("btnPins"),
    };

    Object.entries(buttons).forEach(([type, btn]) => {
        if (type === activeType) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
            btn.style.cursor = "not-allowed";
        } else {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    });
}

// Carregar itens de uma URL específica e renderizar
function loadItems(url, dataMappingFunc, additionalElementsFunc, type, isBanner = false) {
    cleanItems();
    currentUrl = url;
    currentMappingFunc = dataMappingFunc;
    currentAdditionalElementsFunc = additionalElementsFunc;
    currentIsBanner = isBanner;
    currentType = type;

    updateButtonsState(type);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            currentData = data.rows;
            renderItems();
        })
        .catch(error => console.error(`Erro ao carregar ${url}:`, error));
}

// Renderizar e ordenar os itens
function renderItems() {
    cleanItems();

    const sortOrder = document.getElementById("sort").value;
    let sortedData = [...currentData];

    if (sortOrder === "alphabetical") {
        sortedData.sort((a, b) => a[2].toString().localeCompare(b[2].toString()));
    } else if (sortOrder === "price") {
        sortedData.sort((a, b) => parseFloat(a[3]) - parseFloat(b[3]));
    } else if (sortOrder === "collection") {
        sortedData.sort((a, b) => b[4].toString().localeCompare(a[4].toString()));
    }

    sortedData.forEach(async rowData => {
        const additionalElements = currentAdditionalElementsFunc ? currentAdditionalElementsFunc(rowData) : [];
        const itemDiv = createCommonElements(await currentMappingFunc(rowData), additionalElements, currentIsBanner);
        itemDiv.onclick = () => copyCommand(rowData);
        container.appendChild(itemDiv);
    });

    document.getElementById("shop").appendChild(container);
}

function sortItems() {
    renderItems();
}

// Carregar tipos específicos de itens
function loadColors() {
    loadItems('./public/data/tb_colors.json', rowData => [
        `<b>${rowData[1]}</b>`,
        `${rowData[3]} <img class="emoji" src="./public/assets/images/emojis/quartz.png">`,
        rowData[6]
    ], null, "cores");
}

function loadTitles() {
    loadItems('./public/data/tb_titles.json', async rowData => [
        `« <b>${rowData[1]}</b> »`,
        `<i>${await searchCollectionName(rowData[4])}</i>`,
        `${rowData[2]} <img class="emoji" src="./public/assets/images/emojis/quartz.png">`,
    ], null, "titulos");
}

function loadBanners() {
    loadItems('./public/data/tb_banners.json', async rowData => [
        `<b>${rowData[1]}</b>`,
        `<i>${await searchCollectionName(rowData[4])}</i>`,
        `${rowData[3]} <img class="emoji" src="./public/assets/images/emojis/quartz.png">`,
        rowData[2]
    ], null, "banners", true);
}

function loadPins() {
    loadItems('./public/data/tb_pins.json', async rowData => [
        `<b>${rowData[1]}</b>`,
        `<i>${await searchCollectionName(rowData[4])}</i>`,
        `${rowData[3]} <img class="emoji" src="./public/assets/images/emojis/quartz.png">`,
        rowData[5]
    ], null, "emblemas");
}

// Buscar o nome da coleção
async function searchCollectionName(collectionId) {
    try {
        const response = await fetch('./public/data/tb_collections.json');
        const data = await response.json();
        const collection = data.rows.find(row => row[0] === Number(collectionId));
        return collection ? collection[1] : 'Collection not found.';
    } catch (error) {
        console.error('Erro ao carregar o JSON:', error);
        return 'Error loading collection name.';
    }
}

// Carregar cores por padrão ao abrir
document.addEventListener("DOMContentLoaded", () => {
    loadColors();
});

// Carregar os comandos em uma tabela
document.addEventListener("DOMContentLoaded", async () => {
    const tableContainer = document.querySelector(".command-table");
    if (!tableContainer) return;

    try {
        // Carrega o JSON (ajuste o caminho conforme seu projeto)
        const response = await fetch("./public/data/tb_commands.json");
        const data = await response.json();

        // Ordena por "position" (menor = mais usado)
        const sortedRows = data.rows.sort((a, b) => a[5] - b[5]);

        // Cria o cabeçalho da tabela
        const table = document.createElement("table");
        table.className = "command-table";

        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
            <th>Ranking</th>
            <th>Comando</th>
            <th>Categoria</th>
            <th>Descrição</th>
        `;
        table.appendChild(headerRow);

        // Itera pelas linhas ordenadas
        let rank = 1;
        for (const row of sortedRows) {
            const [id, uuid, internalName, command, description, position] = row;

            // Extrai categoria e descrição
            const [category, desc] = description.includes(":")
                ? description.split(":").map(s => s.trim())
                : ["-", description];

            // Monta linha
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <th>${rank}º</th>
                <th><span class="command">${command}</span></th>
                <td>${category}</td>
                <td><i>${desc}</i></td>
            `;
            table.appendChild(tr);
            rank++;
        }

        // Substitui a tabela antiga
        tableContainer.replaceWith(table);

    } catch (err) {
        console.error("Erro ao carregar comandos:", err);
        tableContainer.innerHTML = "<tr><td colspan='4'>Erro ao carregar comandos.</td></tr>";
    }
});