import { dialogService } from 'odoo-typescript/v18/dist/addons/web/core/dialog/dialog_service'
import { PosConfig, PosStore, Product, Warehouse, WarehouseQty } from './types'
import { getL10n, useRender } from './util'
import * as odoo from 'odoo-typescript/v18'
import { logger, TAG } from './log'
import { OdooEnv } from 'odoo-typescript/v18/dist/addons/web/env'
import { StockError } from './errors'
import { busService } from 'odoo-typescript/v18/dist/addons/bus/services/bus_service'
import { ProductChangeMessage } from './patch/pos_store'
import { getEnv } from './patch/pos_app'
const { Component, xml } = odoo.require('@odoo/owl')

interface PosStockDeps {
  pos: PosStore
  dialog: ReturnType<typeof dialogService.start>
}

export class PosStock {
  store: PosStore
  config: PosStockConfig
  dialog: ReturnType<typeof dialogService.start>
  _state: {
    selectedWh: number | undefined
  }

  constructor(deps: PosStockDeps) {
    this.store = deps.pos
    this.config = new PosStockConfig(deps.pos.config)
    this.dialog = deps.dialog

    this._state = {
      selectedWh: this.config.enabled ? this.defaultWarehouse().id : undefined,
    }
  }

  defaultWarehouse(): Warehouse {
    const warehouses = this.config.warehouses
    return warehouses.length > 0 ? warehouses[0] : this.config.warehouse
  }

  get state() {
    return this._state
  }

  get selectedWh() {
    return this.state.selectedWh
  }

  assertStock(product: Product, quantity: number) {
    if (this.shouldDeny(product, quantity)) {
      throw new StockError(this.denyMessage(product) as string)
    }
  }

  productStock(product: Product) {
    // fetch newest record from pos_data service
    const p = getEnv().services['pos_data'].models['product.product'].get(product.id)
    return new ProductStock(p, this.config)
  }

  shouldDeny(product: Product, quantity: number) {
    if (!this.config.enabled) {
      return false
    }
    const stockProduct = this.productStock(product)
    logger?.debug(TAG, 'shouldDeny', stockProduct, quantity, this.selectedWh)
    return stockProduct.shouldDeny(quantity, this.selectedWh)
  }

  denyMessage(product: Product) {
    const stockProduct = this.productStock(product)
    return stockProduct.denyMessage()
  }

  showDenyDialog(product: Product): void {
    this.showErrorDialog(this.denyMessage(product) as string)
  }

  showErrorDialog(message: string) {
    const { _t } = getL10n()
    const { AlertDialog } = odoo.require('@web/core/confirmation_dialog/confirmation_dialog')
    this.dialog.add(AlertDialog, {
      title: _t('Selling not allowed'),
      body: message,
    })
  }
}

export class PosStockConfig {
  config: PosConfig

  constructor(config: PosConfig) {
    this.config = config
  }

  get enabled() {
    return this.config.module_ab_stock
  }

  get warehouses() {
    return this.config.ab_stock_warehouses
  }

  get denyType() {
    return this.config.ab_stock_deny
  }

  get denyQty() {
    return this.config.ab_stock_deny_qty
  }

  get displayType() {
    return this.config.ab_stock_display
  }

  get warehouse() {
    return this.config.warehouse_id
  }
}

export class ProductStock {
  config: PosStockConfig
  product: Product
  warehouses: WarehouseQty[]
  outOfStock: boolean

  constructor(product: Product, config: PosStockConfig) {
    this.config = config
    this.product = product
    this.outOfStock = product.ab_stock_out_of_stock
    this.warehouses = product.ab_stock_warehouses
  }

  stock(wId?: number): number {
    const warehouse = this.warehouses.find((w) => w.id == wId)
    if (wId !== undefined && warehouse !== undefined) {
      return warehouse.available
    }
    return this.warehouses.reduce((acc, w) => acc + w.available, 0)
  }

  inStockMsg(wId?: number) {
    const { _t } = getL10n()
    return this.isOutOfStock(wId) ? _t('sold out') : _t('in stock')
  }

  stockLeftMsg(wId?: number) {
    const { _t } = getL10n()
    const stock = this.stock(wId)
    return stock >= 0 ? _t('%s left', stock) : _t('%s oversold', Math.abs(stock))
  }

  message(wId?: number) {
    if (this.config.displayType == 'binary' || !this.storable) {
      return this.inStockMsg(wId)
    }
    return this.stockLeftMsg(wId)
  }

  get storable(): boolean {
    return this.product.is_storable
  }

  isOutOfStock(wId?: number, qty: number = 0): boolean {
    if (!this.storable) {
      return this.outOfStock
    }
    if (this.outOfStock === true) {
      return true
    }
    return this.stock(wId) - qty <= 0
  }

  get denyType() {
    return this.product.ab_stock_deny != 'default'
      ? this.product.ab_stock_deny
      : this.config.denyType
  }

  get denyQty() {
    return this.product.ab_stock_deny != 'default'
      ? this.product.ab_stock_deny_qty
      : this.config.denyQty
  }

  shouldDeny(qty: number, wId?: number): boolean {
    if (qty <= 0 || this.denyType == 'never') {
      return false
    }
    if (this.denyType == 'out' || !this.storable) {
      return this.isOutOfStock(wId, qty - 1)
    }
    return this.stock(wId) - qty < this.denyQty
  }

  denyMessage() {
    const { _t } = getL10n()
    if (this.denyType == 'out' || !this.storable) {
      return _t('%s is out of stock.', this.product.display_name)
    }
    return _t('Oversell limit of %s reached.', this.denyQty)
  }
}

odoo.define({
  name: '@abichinger_pos_stock/stock',
  deps: {
    reg: '@web/core/registry',
  },
  factory({ reg }) {
    const { registry } = reg

    const posStockService = {
      dependencies: ['pos', 'dialog'],
      async start(_: any, deps: any) {
        logger?.debug(TAG, 'Start service')
        return new PosStock(deps)
      },
    }

    registry.category('services').add('ab_pos_stock', posStockService)
  },
})

export class ProductStockWidget extends Component {
  static template = xml`<div class="flex-grow-1"></div>
      <div class="text-white rounded-3 text-center" t-attf-class=" {{ outOfStock ? 'bg-danger' : 'bg-success' }}" t-if="show" t-out="stock"></div>`

  static props = {
    product: { type: Object, optional: false },
  }

  posStock: PosStock
  productStock: ProductStock
  state: PosStock['state']
  bus: ReturnType<typeof busService.start>
  forceUpdate: () => void

  setup() {
    const { useState, onWillDestroy } = odoo.require('@odoo/owl')

    this.posStock = useStock()
    this.productStock = this.posStock.productStock(this.props.product)
    this.state = useState(this.posStock.state)

    // HACK: I have not found any way to make product reactive
    this.forceUpdate = useRender().forceUpdate
    this.bus = this.env.services['bus_service']
    this.bus.subscribe('POS_PRODUCT_CHANGE', this.onProductChange.bind(this))
    onWillDestroy(() => {
      this.bus.unsubscribe('POS_PRODUCT_CHANGE', this.onProductChange.bind(this))
    })
  }

  onProductChange({ product_ids }: ProductChangeMessage) {
    if (!product_ids.includes(this.props.product.id)) {
      return
    }
    // wait for pos_data service to fetch new record
    setTimeout(() => {
      this.productStock = this.posStock.productStock(this.props.product)
      this.forceUpdate()
    }, 1000)
  }

  get stock() {
    return this.productStock.message(this.state.selectedWh)
  }

  get outOfStock(): boolean {
    return this.productStock.isOutOfStock(this.state.selectedWh)
  }

  get show(): boolean {
    return this.posStock.config.enabled && this.productStock.config.displayType !== 'hide'
  }
}

export function useStock(env?: OdooEnv): PosStock {
  if (env) {
    return env.services['ab_pos_stock']
  }
  const { useService } = odoo.require('@web/core/utils/hooks')
  return useService('ab_pos_stock')
}
