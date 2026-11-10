const productList = document.querySelector(".productList");
const page = productList.querySelector(".page");
let allProducts = [];
let products = [];
const pageSize = 4;
let currentPage = 1;
let editingProductId = null;
let sortField = "price";
let sortOrder = "asc";
let sortApplied = false;

const renderStatistics = () => {
  const totalQuantity = allProducts.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const lowStockCount = allProducts.filter(
    (product) => product.quantity < product.min_quantity,
  ).length;
  const inventoryValue = allProducts.reduce(
    (total, product) => total + product.price * product.quantity,
    0,
  );

  document.querySelector("#totalProducts").textContent = allProducts.length;
  document.querySelector("#totalQuantity").textContent = totalQuantity;
  document.querySelector("#lowStockCount").textContent = lowStockCount;
  document.querySelector("#inventoryValue").textContent = inventoryValue.toLocaleString("ko-KR");
};

const renderProducts = () => {
  const totalPages = Math.ceil(products.length / pageSize);
  currentPage = Math.min(currentPage, totalPages || 1);
  productList.querySelectorAll(".card").forEach((card) => card.remove());

  const startIndex = (currentPage - 1) * pageSize;
  products.slice(startIndex, startIndex + pageSize).forEach((product) => {
    const card = createProductCard(product);
    productList.insertBefore(card, page);
  });

  document.querySelector("#pageIndicator").textContent = `${currentPage} / ${totalPages || 1}`;
  document.querySelector("#previousPage").disabled = currentPage === 1;
  document.querySelector("#nextPage").disabled = currentPage === totalPages || totalPages === 0;
};

const loadProducts = async () => {
  const errorMessage = document.querySelector("#apiError");
  errorMessage.hidden = true;

  try {
    allProducts = (await api.readAll()).filter((product) => !product.deleted);
    applyProductSearch();
    renderStatistics();
  } catch (error) {
    console.error("상품 데이터를 불러오지 못했습니다.", error);
    errorMessage.textContent = `상품 데이터를 불러오지 못했습니다: ${error.message}`;
    errorMessage.hidden = false;
  }
};

const applyProductSearch = () => {
  const searchTerm = document
    .querySelector("#productSearchInput")
    .value.trim()
    .toLocaleLowerCase("ko-KR");
  products = allProducts.filter(
    (product) =>
      product.name.toLocaleLowerCase("ko-KR").includes(searchTerm) ||
      product.code.toLocaleLowerCase("ko-KR").includes(searchTerm),
  );
  if (sortApplied) {
    products.sort((first, second) =>
      sortOrder === "asc"
        ? first[sortField] - second[sortField]
        : second[sortField] - first[sortField],
    );
  }
  currentPage = 1;
  document.querySelector("#productCount").textContent = `${products.length}개`;
  renderProducts();
};

const createTextElement = (tagName, text) => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

const createProductCard = (product) => {
  const card = document.createElement("div");
  card.className = "card";

  const details = document.createElement("div");
  details.className = "details";

  const productDetails = document.createElement("div");
  productDetails.className = "detail";

  const selection = document.createElement("div");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "productCard";
  radio.id = `product${product.code.toLowerCase()}`;
  const label = createTextElement("label", product.name);
  label.htmlFor = radio.id;
  selection.append(radio, label);

  productDetails.append(
    selection,
    createTextElement("span", `${product.code}·${product.category}`),
    createTextElement("span", `공급업체: ${product.supplier}`),
  );

  const inventoryDetails = document.createElement("div");
  inventoryDetails.className = "detail";
  const status = createTextElement("span", product.status);
  status.className = product.status === "판매중" ? "productStatus active" : "productStatus stopped";
  const price = createTextElement("span", `${product.price.toLocaleString("ko-KR")}원`);
  price.className = "productPrice";
  const quantity = createTextElement("span", `재고 ${product.quantity}개`);
  quantity.className =
    product.quantity >= 10 ? "productQuantity sufficient" : "productQuantity low";
  inventoryDetails.append(status, price, quantity);

  details.append(productDetails, inventoryDetails);

  const buttons = document.createElement("div");
  buttons.className = "button";
  const editButton = createTextElement("button", "수정");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.dataset.productId = product.id;
  const deleteButton = createTextElement("button", "삭제");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.productId = product.id;
  buttons.append(editButton, deleteButton);

  card.append(details, buttons);
  return card;
};

const productDialog = document.querySelector("#productDialog");
const productForm = document.querySelector("#productForm");

const generateProductCode = async () => {
  const [activeProducts, deletedProducts] = await Promise.all([
    api.readAll(),
    api.readAll({ deleted: true }),
  ]);
  const existingCodes = new Set(
    [...activeProducts, ...deletedProducts].map((product) => product.code),
  );
  const firstCandidate = Math.floor(Math.random() * 1_000_000);

  for (let offset = 0; offset < 1_000_000; offset += 1) {
    const number = (firstCandidate + offset) % 1_000_000;
    const code = `P${String(number).padStart(6, "0")}`;
    if (!existingCodes.has(code)) {
      return code;
    }
  }

  throw new Error("사용 가능한 상품 코드를 생성할 수 없습니다.");
};

const openProductDialog = async (product = null) => {
  editingProductId = product?.id ?? null;
  productForm.reset();
  const dialogError = document.querySelector("#productDialogError");
  dialogError.hidden = true;
  document.querySelector("#productDialogTitle").textContent = product
    ? "상품 수정"
    : "상품 등록";

  if (product) {
    for (const field of [
      "code",
      "name",
      "category",
      "price",
      "quantity",
      "min_quantity",
      "supplier",
    ]) {
      productForm.elements.namedItem(field).value = product[field];
    }
  } else {
    try {
      productForm.elements.namedItem("code").value = await generateProductCode();
    } catch (error) {
      console.error("상품 코드를 생성하지 못했습니다.", error);
      dialogError.textContent = `상품 코드를 생성하지 못했습니다: ${error.message}`;
      dialogError.hidden = false;
    }
  }

  productDialog.showModal();
  productForm.elements.namedItem("code").focus();
};

const cancelProductDialog = () => {
  productForm.reset();
  editingProductId = null;
  document.querySelector("#productDialogError").hidden = true;
  productDialog.close();
};

const saveProduct = async (event) => {
  event.preventDefault();
  const saveButton = document.querySelector("#saveProductButton");
  const dialogError = document.querySelector("#productDialogError");
  const formData = new FormData(productForm);
  const product = Object.fromEntries(formData.entries());
  for (const field of ["price", "quantity", "min_quantity"]) {
    product[field] = Number(product[field]);
  }

  saveButton.disabled = true;
  dialogError.hidden = true;
  try {
    if (editingProductId === null) {
      await api.create(product);
    } else {
      await api.update(editingProductId, product);
    }
    productDialog.close();
    await loadProducts();
  } catch (error) {
    console.error("상품을 저장하지 못했습니다.", error);
    dialogError.textContent = `상품을 저장하지 못했습니다: ${error.message}`;
    dialogError.hidden = false;
  } finally {
    saveButton.disabled = false;
  }
};

const deleteProduct = async (productId) => {
  const product = allProducts.find((item) => item.id === productId);
  if (!product || !window.confirm(`'${product.name}' 상품을 삭제할까요?`)) {
    return;
  }

  const errorMessage = document.querySelector("#apiError");
  errorMessage.hidden = true;
  try {
    await api.delete(productId);
    await loadProducts();
  } catch (error) {
    console.error("상품을 삭제하지 못했습니다.", error);
    errorMessage.textContent = `상품을 삭제하지 못했습니다: ${error.message}`;
    errorMessage.hidden = false;
  }
};

document.querySelector("#previousPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderProducts();
  }
});

document.querySelector("#nextPage").addEventListener("click", () => {
  if (currentPage < Math.ceil(products.length / pageSize)) {
    currentPage += 1;
    renderProducts();
  }
});

document
  .querySelector("#productSearchInput")
  .addEventListener("input", applyProductSearch);
const sortProducts = (order) => {
  sortField = document.querySelector("#sortField").value;
  sortOrder = order;
  sortApplied = true;
  applyProductSearch();
  document.querySelector("#sortProductsButton").textContent =
    order === "asc" ? "내림차순" : "오름차순";
};

document
  .querySelector("#sortProductsButton")
  .addEventListener("click", () =>
    sortProducts(sortApplied && sortOrder === "asc" ? "desc" : "asc"),
  );
document
  .querySelector("#createProductButton")
  .addEventListener("click", () => openProductDialog());
document
  .querySelector("#cancelProductButton")
  .addEventListener("click", cancelProductDialog);
productDialog.addEventListener("click", (event) => {
  if (event.target === productDialog) {
    cancelProductDialog();
  }
});
productForm.addEventListener("submit", saveProduct);
productList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const productId = Number(button.dataset.productId);
  if (button.dataset.action === "edit") {
    const product = allProducts.find((item) => item.id === productId);
    if (product) {
      openProductDialog(product);
    }
  } else if (button.dataset.action === "delete") {
    deleteProduct(productId);
  }
});

loadProducts();
