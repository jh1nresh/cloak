import DropStorefront from "@/components/drop/DropStorefront";
import { dropProducts } from "@/lib/drop-products";

export default function Home() {
  return <DropStorefront products={dropProducts} />;
}
