const DATA_PATH = "./public/data/";

// Separar casas de milhar, igual o bot faz nas mensagens
function formatNumber(value) {
    return Number(value).toLocaleString("pt-BR");
}

// Escapar texto vindo do banco antes de jogar no HTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* ========= LOJINHA ========= */

// Configuração de cada tipo de item da loja
const SHOP_TYPES = {
    cores: {
        file: "tb_colors.json",
        buttonId: "btnColors",
        displayName: "Cor",
        fields: { name: 1, price: 3, collection: 4 },
        cells: row => [
            { html: `<b>${escapeHtml(row[1])}</b>` },
            { html: `${formatNumber(row[3])} <img class="emoji" src="./public/assets/images/emojis/quartz.png" alt="quartzos">` },
            { image: row[6], alt: `Cor ${row[1]}` }
        ]
    },
    banners: {
        file: "tb_banners.json",
        buttonId: "btnBanners",
        displayName: "Banner",
        fields: { name: 1, price: 3, collection: 4 },
        wideImage: true,
        cells: (row, collectionName) => [
            { html: `<b>${escapeHtml(row[1])}</b>` },
            { html: `<i>${escapeHtml(collectionName)}</i>` },
            { html: `${formatNumber(row[3])} <img class="emoji" src="./public/assets/images/emojis/quartz.png" alt="quartzos">` },
            { image: row[2], alt: `Banner ${row[1]}` }
        ]
    },
    titulos: {
        file: "tb_titles.json",
        buttonId: "btnTitles",
        displayName: "Título",
        fields: { name: 1, price: 2, collection: 4 },
        cells: (row, collectionName) => [
            { html: `« <b>${escapeHtml(row[1])}</b> »` },
            { html: `<i>${escapeHtml(collectionName)}</i>` },
            { html: `${formatNumber(row[2])} <img class="emoji" src="./public/assets/images/emojis/quartz.png" alt="quartzos">` }
        ]
    },
    emblemas: {
        file: "tb_pins.json",
        buttonId: "btnPins",
        displayName: "Emblema",
        fields: { name: 1, price: 3, collection: 4 },
        cells: (row, collectionName) => [
            { html: `<b>${escapeHtml(row[1])}</b>` },
            { html: `<i>${escapeHtml(collectionName)}</i>` },
            { html: `${formatNumber(row[3])} <img class="emoji" src="./public/assets/images/emojis/quartz.png" alt="quartzos">` },
            { image: row[5], alt: `Emblema ${row[1]}` }
        ]
    }
};

// Variáveis globais
let collectionsPromise = null;   // cache do tb_collections.json
let currentType = null;          // tipo de item exibido agora
let currentRows = [];            // linhas cruas do JSON desse tipo
let itemContainer = null;        // contêiner dos itens (dentro do #shop)
let currentRequest = 0;          // número do pedido mais recente

// Buscar os nomes das coleções, uma vez só
function loadCollections() {
    if (!collectionsPromise) {
        collectionsPromise = fetch(DATA_PATH + "tb_collections.json")
            .then(response => response.json())
            .then(data => new Map(data.rows.map(row => [Number(row[0]), row[1]])))
            .catch(error => {
                console.error("Erro ao carregar as coleções:", error);
                collectionsPromise = null;
                return new Map();
            });
    }
    return collectionsPromise;
}

// Mostrar um aviso rápido no rodapé da tela
function showToast(message) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

// Copiar o item para a área de transferência: "Tipo: Nome (Coleção)"
async function copyItemCommand(row, type, collectionName) {
    const item = `${SHOP_TYPES[type].displayName}: ${row[1]} (${collectionName})`;

    try {
        await navigator.clipboard.writeText(item);
        showToast(`Copiado! Use "/item buy" e cole no campo do item.`);
    } catch (error) {
        console.error("Erro ao copiar o item:", error);
        showToast(`Não consegui copiar o comando. O item é "${item}".`);
    }
}

// Montar o card de um item
function buildItemCard(row, type, collections) {
    const config = SHOP_TYPES[type];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "item";
    card.title = "Clique para copiar o item";

    const collectionName = collections.get(Number(row[config.fields.collection])) || "Coleção desconhecida";

    config.cells(row, collectionName).forEach(cell => {
        if (cell.image) {
            const image = document.createElement("img");
            image.src = cell.image;
            image.alt = cell.alt || "";
            image.loading = "lazy";
            image.className = config.wideImage ? "item-image wide" : "item-image";
            card.appendChild(image);
        } else {
            const paragraph = document.createElement("p");
            paragraph.innerHTML = cell.html;
            card.appendChild(paragraph);
        }
    });

    card.addEventListener("click", () => copyItemCommand(row, type, collectionName));
    return card;
}

// Ordenar os itens conforme o seletor da página
function sortRows(rows, type, collections) {
    const fields = SHOP_TYPES[type].fields;
    const order = document.getElementById("sort").value;
    const sorted = [...rows];

    if (order === "alphabetical")
        sorted.sort((a, b) => String(a[fields.name]).localeCompare(String(b[fields.name]), "pt-BR"));
    else if (order === "price")
        sorted.sort((a, b) => Number(a[fields.price]) - Number(b[fields.price]));
    else if (order === "collection")
        // Pelo nome da coleção, com o nome do item como desempate.
        sorted.sort((a, b) => {
            const nameA = collections.get(Number(a[fields.collection])) || "";
            const nameB = collections.get(Number(b[fields.collection])) || "";
            return nameA.localeCompare(nameB, "pt-BR") || String(a[fields.name]).localeCompare(String(b[fields.name]), "pt-BR");
        });

    return sorted;
}

// Renderizar os itens já ordenados
function renderItems() {
    if (!currentType) return;

    return loadCollections().then(collections => {
        itemContainer.innerHTML = "";
        sortRows(currentRows, currentType, collections)
            .forEach(row => itemContainer.appendChild(buildItemCard(row, currentType, collections)));
    });
}

// Atualizar o estado dos botões
function updateButtonsState(activeType) {
    Object.entries(SHOP_TYPES).forEach(([type, config]) => {
        const button = document.getElementById(config.buttonId);
        if (!button) return;
        button.disabled = type === activeType;
        button.setAttribute("aria-pressed", String(type === activeType));
    });
}

// Carregar um tipo de item e renderizar
async function loadItems(type) {
    const request = ++currentRequest;
    currentType = type;
    updateButtonsState(type);
    itemContainer.innerHTML = "";

    try {
        const response = await fetch(DATA_PATH + SHOP_TYPES[type].file);
        const data = await response.json();
        if (request !== currentRequest) return;

        currentRows = data.rows;
        await renderItems();
    } catch (error) {
        if (request !== currentRequest) return;
        console.error(`Erro ao carregar ${SHOP_TYPES[type].file}:`, error);
        itemContainer.innerHTML = "<p>Não consegui carregar os itens agora. Tente recarregar a página.</p>";
    }
}

// Carregar tipos específicos de itens (chamados pelos botões da página)
function loadColors() {
    return loadItems("cores");
}

function loadBanners() {
    return loadItems("banners");
}

function loadTitles() {
    return loadItems("titulos");
}

function loadPins() {
    return loadItems("emblemas");
}

// Reordenar sem buscar de novo (chamado pelo seletor de ordem)
function sortItems() {
    return renderItems();
}

// Preparar a lojinha e carregar cores por padrão
function setupShop() {
    const shop = document.getElementById("shop");
    if (!shop) return;

    itemContainer = document.createElement("div");
    itemContainer.className = "item-container";
    shop.appendChild(itemContainer);

    return loadColors();
}

/* ========= TABELA DE COMANDOS ========= */

// Carregar os comandos em uma tabela (já é ordenado do mais usado para o menos usado)
async function setupCommandTable() {
    const placeholder = document.querySelector(".command-table");
    if (!placeholder) return;

    try {
        const response = await fetch(DATA_PATH + "tb_commands.json");
        const data = await response.json();

        const table = document.createElement("table");
        table.className = "command-table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th scope="col">Ranking</th>
                    <th scope="col">Comando</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Descrição</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const body = table.querySelector("tbody");
        data.rows.forEach(([typing, category, description, , position]) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <th scope="row">${position}º</th>
                <td><span class="command">${escapeHtml(typing)}</span></td>
                <td>${escapeHtml(category)}</td>
                <td><i>${escapeHtml(description)}</i></td>
            `;
            body.appendChild(row);
        });

        // As 4 colunas não cabem na tela do celular, então o wrapper deixa a tabela rolar sozinha, sem esticar a página
        const scroller = document.createElement("div");
        scroller.className = "table-scroll";
        scroller.appendChild(table);
        placeholder.replaceWith(scroller);
    } catch (error) {
        console.error("Erro ao carregar comandos:", error);
        placeholder.innerHTML = "<tr><td colspan='4'>Erro ao carregar comandos.</td></tr>";
    }
}

// Montar o que existir na página aberta
document.addEventListener("DOMContentLoaded", () => {
    setupShop();
    setupCommandTable();
});
