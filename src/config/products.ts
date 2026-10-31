import productsJson from "./products.json";

export type ProductStatus = "partial" | "not-implemented";
export interface ProductDefinition {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  status: ProductStatus;
  icon: string;
  accent: string;
}
export const products = productsJson as ProductDefinition[];
export const getProductBySlug = (slug: string) => products.find((item) => item.slug === slug);
