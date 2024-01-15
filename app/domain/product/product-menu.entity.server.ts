import { BaseEntity } from "../base.entity";
import { ProductMenu, ProductMenuModel } from "./product-menu.model.server";

export class ProductMenuEntity extends BaseEntity<ProductMenu> {}

export const productMenuEntity = new ProductMenuEntity(ProductMenuModel);
