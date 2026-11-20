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

export type PaymentGatewayId = 'bkash' | 'nagad' | 'rocket';
export type PaymentAccountType = 'Personal' | 'Agent' | 'Merchant';
export type DeliveryZone = 'inside_city' | 'outside_city';
export type CheckoutPaymentType = 'full_payment' | 'cod_advance';
export type OrderStatus = 'Pending' | 'Verified' | 'Shipped' | 'Delivered' | 'Rejected';

export interface CartItem {
  watchId: string;
  product_name?: string;
  brand: string;
  model: string;
  color: string;
  image_url?: string;
  unitPrice: number;
  maxStock: number;
  quantity: number;
}

export interface PaymentGatewayConfig {
  id: PaymentGatewayId;
  label: string;
  enabled: boolean;
  number: string;
  accountType: PaymentAccountType;
}

export interface StorePaymentSettings {
  gateways: Record<PaymentGatewayId, PaymentGatewayConfig>;
  insideCityCharge: number;
  outsideCityCharge: number;
  insideCityLabel: string;
  outsideCityLabel: string;
  requireCodAdvanceDelivery: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  updatedAt?: string;
}

export interface OrderLineItem {
  watchId: string;
  productName: string;
  brand: string;
  model: string;
  color: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_zone: DeliveryZone;
  delivery_charge: number;
  subtotal: number;
  total_amount: number;
  payment_type: CheckoutPaymentType;
  payment_gateway: PaymentGatewayId | 'cod';
  receiving_number: string;
  sender_number: string;
  trx_id: string;
  paid_amount: number;
  due_amount: number;
  status: OrderStatus;
  items: OrderLineItem[];
  notes?: string;
  created_at: string;
}

export interface CustomerAccount {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  phone_normalized: string;
  default_address: string;
  delivery_zone: DeliveryZone;
  created_at: string;
}

export interface CustomerMessage {
  id: string;
  customer_phone_normalized: string;
  customer_name: string;
  order_number?: string;
  sender: 'admin' | 'customer';
  body: string;
  read_by_admin: boolean;
  read_by_customer: boolean;
  created_at: string;
}

export interface PinResetRequest {
  id: string;
  phone_normalized: string;
  phone: string;
  customer_name: string;
  customer_code: string;
  reset_code: string;
  created_at: string;
  expires_at: string;
}
