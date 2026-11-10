const deletedProductList = document.querySelector(".productList");
const deletedPage = deletedProductList.querySelector(".page");
const pageSize = 4;
let deletedProducts = [];
let filteredDeletedProducts = [];
let currentDeletedPage = 1;
let sortField = "price";
let sortOrder = "asc";
let sortApplied = false;

const createTextElement = (tagName, text) => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

const renderDeletedProducts = () => {
  const totalPages = Math.ceil(filteredDeletedProducts.length / pageSize);
  currentDeletedPage = Math.min(currentDeletedPage, totalPages || 1);
  deletedProductList.querySelectorAll(".card").forEach((card) => card.remove());

  const startIndex = (currentDeletedPage - 1) * pageSize;
  filteredDeletedProducts
    .slice(startIndex, startIndex + pageSize)
    .forEach((product) => {
      const card = document.createElement("div");
      card.className = "card";

      const details = document.createElement("div");
      details.className = "details";
      const productDetails = document.createElement("div");
      productDetails.className = "detail";
      productDetails.append(
        createTextElement("strong", product.name),
        createTextElement("span", `${product.code}·${product.category}`),
        createTextElement("span", `공급업체: ${product.supplier}`),
      );
      const inventoryDetails = document.createElement("div");
      inventoryDetails.className = "detail";
      inventoryDetails.append(
        createTextElement("span", "삭제됨"),
        createTextElement("span", `${product.price.toLocaleString("ko-KR")}원`),
        createTextElement("span", `재고 ${product.quantity}개`),
      );
      details.append(productDetails, inventoryDetails);

      const buttons = document.createElement("div");
      buttons.className = "button";
      const restoreButton = createTextElement("button", "삭제 취소");
      restoreButton.type = "button";
      restoreButton.dataset.action = "restore";
      restoreButton.dataset.productId = product.id;
      const permanentDeleteButton = createTextElement("button", "완전 삭제");
      permanentDeleteButton.type = "button";
      permanentDeleteButton.dataset.action = "permanent-delete";
      permanentDeleteButton.dataset.productId = product.id;
      buttons.append(restoreButton, permanentDeleteButton);
      card.append(details, buttons);
      deletedProductList.insertBefore(card, deletedPage);
    });

  document.querySelector("#deletedProductCount").textContent =
    `${filteredDeletedProducts.length}개`;
  document.querySelector("#deletedPageIndicator").textContent =
    `${currentDeletedPage} / ${totalPages || 1}`;
  document.querySelector("#previousDeletedPage").disabled =
    currentDeletedPage === 1;
  document.querySelector("#nextDeletedPage").disabled =
    currentDeletedPage === totalPages || totalPages === 0;
};

const applyDeletedProductFilters = () => {
  const searchTerm = document
    .querySelector("#deletedProductSearchInput")
    .value.trim()
    .toLocaleLowerCase("ko-KR");
  filteredDeletedProducts = deletedProducts.filter(
    (product) =>
      product.name.toLocaleLowerCase("ko-KR").includes(searchTerm) ||
      product.code.toLocaleLowerCase("ko-KR").includes(searchTerm),
  );
  if (sortApplied) {
    filteredDeletedProducts.sort((first, second) =>
      sortOrder === "asc"
        ? first[sortField] - second[sortField]
        : second[sortField] - first[sortField],
    );
  }
  currentDeletedPage = 1;
  renderDeletedProducts();
};

const loadDeletedProducts = async () => {
  const errorMessage = document.querySelector("#deletedApiError");
  errorMessage.hidden = true;
  try {
    deletedProducts = await api.readAll({ deleted: true });
    applyDeletedProductFilters();
  } catch (error) {
    console.error("삭제 상품을 불러오지 못했습니다.", error);
    errorMessage.textContent = `삭제 상품을 불러오지 못했습니다: ${error.message}`;
    errorMessage.hidden = false;
  }
};

const updateDeletedProduct = async (productId, action) => {
  const product = deletedProducts.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const isPermanentDelete = action === "permanent-delete";
  const prompt = isPermanentDelete
    ? `'${product.name}' 상품을 영구적으로 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
    : `'${product.name}' 상품을 복원할까요?`;
  if (!window.confirm(prompt)) {
    return;
  }

  const errorMessage = document.querySelector("#deletedApiError");
  errorMessage.hidden = true;
  try {
    if (isPermanentDelete) {
      await api.permanentlyDelete(productId);
    } else {
      await api.restore(productId);
    }
    await loadDeletedProducts();
  } catch (error) {
    console.error("삭제 상품을 처리하지 못했습니다.", error);
    errorMessage.textContent = `삭제 상품을 처리하지 못했습니다: ${error.message}`;
    errorMessage.hidden = false;
  }
};

document
  .querySelector("#deletedProductSearchInput")
  .addEventListener("input", applyDeletedProductFilters);
const sortDeletedProducts = (order) => {
  sortField = document.querySelector("#deletedSortField").value;
  sortOrder = order;
  sortApplied = true;
  applyDeletedProductFilters();
  document.querySelector("#sortDeletedProductsButton").textContent =
    order === "asc" ? "내림차순" : "오름차순";
};

document
  .querySelector("#sortDeletedProductsButton")
  .addEventListener("click", () =>
    sortDeletedProducts(sortApplied && sortOrder === "asc" ? "desc" : "asc"),
  );
document
  .querySelector("#previousDeletedPage")
  .addEventListener("click", () => {
    if (currentDeletedPage > 1) {
      currentDeletedPage -= 1;
      renderDeletedProducts();
    }
  });
document.querySelector("#nextDeletedPage").addEventListener("click", () => {
  if (currentDeletedPage < Math.ceil(filteredDeletedProducts.length / pageSize)) {
    currentDeletedPage += 1;
    renderDeletedProducts();
  }
});
deletedProductList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) {
    updateDeletedProduct(Number(button.dataset.productId), button.dataset.action);
  }
});

loadDeletedProducts();
