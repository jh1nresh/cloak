export type DropProductCategory = "dress" | "top" | "jacket" | "skirt" | "set";

export type DropProduct = {
  id: string;
  title: string;
  brand: string;
  price: string;
  color: string;
  category: DropProductCategory;
  imageUrl: string;
  garmentImageUrl: string;
  mockResultImageUrl: string;
  checkoutUrl: string;
  tags: string[];
  fitNote: string;
};

export const dropProducts: DropProduct[] = [
  {
    id: "satin-column-slip",
    title: "Satin Column Slip",
    brand: "Cloak Atelier",
    price: "$168",
    color: "Pearl",
    category: "dress",
    imageUrl:
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/satin-column-slip:1",
    tags: ["evening", "silk touch", "bias cut"],
    fitNote: "Long bias line with a narrow shoulder and fluid hem.",
  },
  {
    id: "cherry-wool-coat",
    title: "Cherry Wool Coat",
    brand: "Cloak Atelier",
    price: "$248",
    color: "Cherry",
    category: "jacket",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/cherry-wool-coat:1",
    tags: ["statement", "tailored", "midweight"],
    fitNote: "Structured shoulder, straight body, and a clean knee-length fall.",
  },
  {
    id: "espresso-knit-set",
    title: "Espresso Knit Set",
    brand: "Mira House",
    price: "$132",
    color: "Espresso",
    category: "set",
    imageUrl:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/espresso-knit-set:1",
    tags: ["soft knit", "travel", "matching"],
    fitNote: "Relaxed knit top with a long skirt that skims instead of clings.",
  },
  {
    id: "plum-bustier-top",
    title: "Plum Bustier Top",
    brand: "Cloak Objects",
    price: "$86",
    color: "Deep plum",
    category: "top",
    imageUrl:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1520975682031-ae0b8000c1b0?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/plum-bustier-top:1",
    tags: ["date night", "corset seam", "cropped"],
    fitNote: "Close fitted through the bodice with a cropped waistline.",
  },
  {
    id: "mirror-trouser",
    title: "Mirror Trouser",
    brand: "Mira House",
    price: "$118",
    color: "Soft grey",
    category: "skirt",
    imageUrl:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/mirror-trouser:1",
    tags: ["office", "wide leg", "pressed"],
    fitNote: "High waist with a fluid wide leg and pressed front crease.",
  },
  {
    id: "ivory-shear-cardigan",
    title: "Ivory Sheer Cardigan",
    brand: "Cloak Atelier",
    price: "$94",
    color: "Ivory",
    category: "top",
    imageUrl:
      "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/ivory-sheer-cardigan:1",
    tags: ["layering", "lightweight", "soft"],
    fitNote: "Semi-sheer rib with a close sleeve and easy body.",
  },
  {
    id: "charcoal-mini-skirt",
    title: "Charcoal Mini Skirt",
    brand: "Noema",
    price: "$78",
    color: "Charcoal",
    category: "skirt",
    imageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/charcoal-mini-skirt:1",
    tags: ["mini", "night out", "tailored"],
    fitNote: "A-line mini with a flat front and slightly higher rise.",
  },
  {
    id: "pearl-wrap-blouse",
    title: "Pearl Wrap Blouse",
    brand: "Noema",
    price: "$102",
    color: "Pearl",
    category: "top",
    imageUrl:
      "https://images.unsplash.com/photo-1520975867597-0f0b7b44a8b8?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1520975867597-0f0b7b44a8b8?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/pearl-wrap-blouse:1",
    tags: ["wrap", "desk to dinner", "soft drape"],
    fitNote: "Adjustable wrap line with a soft V and gathered side tie.",
  },
  {
    id: "smoke-denim-jacket",
    title: "Smoke Denim Jacket",
    brand: "Cloak Objects",
    price: "$146",
    color: "Smoke",
    category: "jacket",
    imageUrl:
      "https://images.unsplash.com/photo-1545291730-faff8ca1d4b0?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1545291730-faff8ca1d4b0?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1496217590455-aa63a8350eea?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/smoke-denim-jacket:1",
    tags: ["denim", "cropped", "weekend"],
    fitNote: "Boxy cropped denim with dropped shoulder and roomy sleeve.",
  },
  {
    id: "plum-mesh-dress",
    title: "Plum Mesh Dress",
    brand: "Mira House",
    price: "$154",
    color: "Plum",
    category: "dress",
    imageUrl:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=80",
    garmentImageUrl:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80",
    mockResultImageUrl:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=80",
    checkoutUrl: "https://cloak-demo.myshopify.com/cart/plum-mesh-dress:1",
    tags: ["mesh", "ruched", "event"],
    fitNote: "Soft mesh overlay with side ruching and a narrow midi silhouette.",
  },
];

export function getDropProduct(id: string) {
  return dropProducts.find((product) => product.id === id) || null;
}
