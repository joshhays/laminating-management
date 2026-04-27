import { ShopFloorClient } from "./shop-floor-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop floor — Yorke Flow",
  description: "Employee sign-in and job time tracking",
};

export default function ShopFloorPage() {
  return <ShopFloorClient />;
}
