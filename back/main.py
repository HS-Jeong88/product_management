import json
from datetime import date
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator

DATA_FILE = Path(__file__).parent / "storage" / "data.json"
DATA_LOCK = Lock()

whiteList = ["http://127.0.0.1:5500","https://product-management-front-33ui.onrender.com"]
app = FastAPI(title="Product Management API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=whiteList,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProductInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=50)
    price: int = Field(ge=0)
    quantity: int = Field(ge=0)
    min_quantity: int = Field(ge=0)
    supplier: str = Field(min_length=1, max_length=100)


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    price: int | None = Field(default=None, ge=0)
    quantity: int | None = Field(default=None, ge=0)
    min_quantity: int | None = Field(default=None, ge=0)
    supplier: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def reject_null_values(self) -> "ProductUpdate":
        if any(value is None for value in self.model_dump(exclude_unset=True).values()):
            raise ValueError("Updated values cannot be null")
        return self


class QuantityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(ge=0)


def read_products() -> list[dict]:
    try:
        with DATA_FILE.open(encoding="utf-8") as file:
            products = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to read product data: {error}",
        ) from error

    if not isinstance(products, list):
        raise HTTPException(status_code=500, detail="Product data must be a JSON array")
    return products


def write_products(products: list[dict]) -> None:
    temporary_file = DATA_FILE.with_suffix(".tmp")
    try:
        with temporary_file.open("w", encoding="utf-8") as file:
            json.dump(products, file, ensure_ascii=False, indent=2)
            file.write("\n")
        temporary_file.replace(DATA_FILE)
    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save product data: {error}",
        ) from error


def find_active_product(products: list[dict], product_id: int) -> dict:
    product = next(
        (
            item
            for item in products
            if item["id"] == product_id and not item.get("deleted", False)
        ),
        None,
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def get_status(quantity: int, min_quantity: int) -> str:
    return "판매중" if quantity > min_quantity else "판매중지"


@app.get("/products")
def get_products(
    name: str | None = None,
    code: str | None = None,
    category: str | None = None,
    status: str | None = None,
    deleted: bool = False,
    sort: Literal["price", "quantity"] | None = None,
    order: Literal["asc", "desc"] = "asc",
    page: int | None = Query(default=None, ge=1),
    limit: int | None = Query(default=None, ge=1, le=100),
) -> list[dict] | dict:
    products = [
        product
        for product in read_products()
        if product.get("deleted", False) is deleted
    ]

    if name:
        search_name = name.casefold()
        products = [
            product for product in products if search_name in product["name"].casefold()
        ]
    if code:
        products = [product for product in products if product["code"] == code]
    if category:
        products = [product for product in products if product["category"] == category]
    if status:
        products = [product for product in products if product["status"] == status]
    if sort:
        products.sort(key=lambda product: product[sort], reverse=order == "desc")

    if page is None and limit is None:
        return products
    page = page or 1
    limit = limit or 10
    start = (page - 1) * limit
    return {
        "items": products[start : start + limit],
        "total": len(products),
        "page": page,
        "limit": limit,
    }


@app.get("/products/{product_id}")
def get_product(product_id: int) -> dict:
    return find_active_product(read_products(), product_id)


@app.post("/products", status_code=201)
def create_product(product_input: ProductInput) -> dict:
    with DATA_LOCK:
        products = read_products()
        if any(product["code"] == product_input.code for product in products):
            raise HTTPException(status_code=409, detail="Product code already exists")

        product_data = product_input.model_dump()
        product = {
            "id": max((item["id"] for item in products), default=0) + 1,
            **product_data,
            "status": get_status(
                product_data["quantity"], product_data["min_quantity"]
            ),
            "created_at": date.today().isoformat(),
            "deleted": False,
            "version": 1,
        }
        products.append(product)
        write_products(products)
    return product


@app.patch("/products/{product_id}")
def update_product(product_id: int, changes: ProductUpdate) -> dict:
    with DATA_LOCK:
        products = read_products()
        product = find_active_product(products, product_id)
        updates = changes.model_dump(exclude_unset=True)

        if "code" in updates and any(
            item["code"] == updates["code"] and item["id"] != product_id
            for item in products
        ):
            raise HTTPException(status_code=409, detail="Product code already exists")

        product.update(updates)
        if "quantity" in updates or "min_quantity" in updates:
            product["status"] = get_status(
                product["quantity"], product["min_quantity"]
            )
        product["version"] += 1
        write_products(products)
    return product


@app.patch("/products/{product_id}/quantity")
def update_product_quantity(product_id: int, change: QuantityUpdate) -> dict:
    with DATA_LOCK:
        products = read_products()
        product = find_active_product(products, product_id)
        product["quantity"] = change.quantity
        product["status"] = get_status(product["quantity"], product["min_quantity"])
        product["version"] += 1
        write_products(products)
    return product


@app.patch("/products/{product_id}/restore")
def restore_product(product_id: int) -> dict:
    with DATA_LOCK:
        products = read_products()
        product = next(
            (
                item
                for item in products
                if item["id"] == product_id and item.get("deleted", False)
            ),
            None,
        )
        if product is None:
            raise HTTPException(status_code=404, detail="Deleted product not found")
        product["deleted"] = False
        product["version"] += 1
        write_products(products)
    return product


@app.delete("/products/{product_id}/permanent")
def permanently_delete_product(product_id: int) -> dict:
    with DATA_LOCK:
        products = read_products()
        product = next(
            (
                item
                for item in products
                if item["id"] == product_id and item.get("deleted", False)
            ),
            None,
        )
        if product is None:
            raise HTTPException(status_code=404, detail="Deleted product not found")
        products.remove(product)
        write_products(products)
    return product


@app.delete("/products/{product_id}")
def delete_product(product_id: int) -> dict:
    with DATA_LOCK:
        products = read_products()
        product = find_active_product(products, product_id)
        product["deleted"] = True
        product["version"] += 1
        write_products(products)
    return product