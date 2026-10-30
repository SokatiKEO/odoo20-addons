import * as odoo from 'odoo-typescript/v18'
import { Warehouse } from '../types'
import { PosStock, useStock } from '../stock'

interface State {
  isMenuOpened: boolean
  pos: typeof PosStock.prototype.state
}

odoo.definePatch({
  name: '@abichinger_pos_stock/navbar',
  deps: {
    navbar: '@point_of_sale/app/navbar/navbar',
    owl: '@odoo/owl',
  },
  objToPatch: ({ navbar }) => navbar.Navbar.prototype,
  patch(self, { owl: { useState } }) {
    return {
      whState: null as any as State,
      posStock: null as any as PosStock,

      /**
       * @override
       */
      setup() {
        super.setup()
        this.posStock = useStock()
        this.whState = useState({
          isMenuOpened: false,
          selectedWh: 0,
          pos: this.posStock.state,
        })
      },

      /**
       * @override https://github.com/odoo/odoo/blob/2a2c76a02835578b9edcd73a7cff88a5bab2576e/addons/point_of_sale/static/src/app/navbar/navbar.js#L42
       */
      onOutsideClick() {
        super.onOutsideClick()
        if (this.showWhMenu) {
          // use timeout, otherwise toggleWhMenu is not working correctly
          setTimeout(() => {
            this.whState.isMenuOpened = false
          }, 50)
        }
      },

      get showWhButton(): boolean {
        return this.posStock.config.enabled && this.abStockWarehouses.length >= 2
      },
      toggleWhMenu(): void {
        this.whState.isMenuOpened = !this.whState.isMenuOpened
      },
      get showWhMenu(): boolean {
        return this.whState.isMenuOpened
      },
      get abStockWarehouses(): Warehouse[] {
        return self(this).pos.config.ab_stock_warehouses
      },
      get selectedWhId(): number | undefined {
        return this.whState.pos.selectedWh
      },

      get selectedWh() {
        const warehouses = this.abStockWarehouses
        return warehouses.find((w) => w.id == this.selectedWhId) ?? warehouses[0]
      },

      onWarehouseButtonClick(warehouse: Warehouse) {
        this.whState.pos.selectedWh = warehouse.id
      },
    }
  },
})
