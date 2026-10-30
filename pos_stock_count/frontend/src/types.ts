import { PosStore as OdooPosStore } from 'odoo-typescript/v18/dist/addons/point_of_sale/app/store/pos_store'

export type DenyType = 'default' | 'never' | 'out' | 'qty'
export type ProductType = 'consu' | 'product' | 'service'
export type DisplayType = 'hide' | 'binary' | 'qty'

export enum ProductTracking {
  SerialNumber = 'serial',
  Lot = 'lot',
  Quantity = 'none',
}

export interface Warehouse {
  id: number
  name: string
  code: string
}

export interface WarehouseQty {
  id: number
  name: string
  available: number
  forecasted: number
}

export interface PosStore extends OdooPosStore {
  config: PosConfig
}

export interface PosConfig {
  module_ab_stock: boolean
  ab_stock_warehouses: Warehouse[]
  ab_stock_deny: DenyType
  ab_stock_deny_qty: number
  ab_stock_display: DisplayType
  warehouse_id: Warehouse
}

export interface Product {
  id: number
  display_name: string
  type: ProductType
  is_storable: boolean
  tracking: ProductTracking
  ab_stock_deny: DenyType
  ab_stock_deny_qty: number
  ab_stock_out_of_stock: boolean
  ab_stock_warehouses: WarehouseQty[]
}
