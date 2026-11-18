export type ProductCategory =
  | 'Analog Watches'
  | 'Digital Watches'
  | 'Smartwatches'
  | 'TWS Earbuds'
  | 'Power Banks'
  | 'Chargers & Cables'
  | 'Bluetooth Speakers'
  | 'Neckbands'
  | 'Gadgets & Accessories';

export interface WatchItem {
  id: string;
  product_name?: string;
  brand: string;
  model: string;
  color: string;
  category: ProductCategory;
  connectivity: string;
  capacity_spec: string;
  /** High anchor / tag price shown to customers */
  display_buying_price: number;
  /** Secret wholesale purchase cost (revealed via triple-tap or admin view) */
  real_buying_price: number;
  /** Lowest selling / offer price */
  min_selling_price: number;
  stock_count: number;
  image_url?: string;
  description: string;
  created_at: string;
}

export interface WatchFormInput {
  product_name?: string;
  brand: string;
  model: string;
  color: string;
  category: ProductCategory;
  connectivity: string;
  capacity_spec: string;
  display_buying_price: number;
  real_buying_price: number;
  min_selling_price: number;
  stock_count: number;
  image_url?: string;
  description: string;
}

export interface MemoLineItem {
  watchId: string;
  brand: string;
  model: string;
  color: string;
  quantity: number;
  unitPrice: number;
  realCost: number;
}

export interface DigitalMemo {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  payment_method: 'Cash' | 'bKash' | 'Nagad' | 'Card';
  discount_amount: number;
  total_amount: number;
  notes: string;
  items: MemoLineItem[];
  created_at: string;
}

export interface VisualSearchMatch {
  watchId: string;
  matchPercentage: number;
  reason: string;
}

export interface VisualSearchResponse {
  detectedProduct: {
    brand: string;
    category: string;
    color: string;
    features: string;
  };
  matches: VisualSearchMatch[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recommendedWatchIds?: string[];
  timestamp: string;
}

export type AppTab = 'catalog' | 'lens' | 'memo' | 'admin';
