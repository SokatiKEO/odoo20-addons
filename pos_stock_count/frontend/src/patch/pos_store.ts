import { definePatch } from 'odoo-typescript/v18'
import { StockError } from '../errors'
import { useStock } from '../stock'
import { getEnv } from './pos_app'
import { OdooEnv } from 'odoo-typescript/v18/dist/addons/web/env'
import { busService } from 'odoo-typescript/v18/dist/addons/bus/services/bus_service'
import { logger, TAG } from '../log'
import { PosData } from 'odoo-typescript/v18/dist/addons/point_of_sale/app/models/data_service'

export interface ProductChangeMessage {
  product_ids: number[]
}

definePatch({
  name: '@abichinger_pos_stock/pos_store',
  deps: { store: '@point_of_sale/app/store/pos_store' },
  objToPatch: ({ store }) => store.PosStore.prototype,
  patch(self) {
    return {
      async setup(env: OdooEnv, deps: any) {
        await super.setup(env, deps)

        const bus: ReturnType<typeof busService.start> = self(this).bus
        bus.subscribe('POS_PRODUCT_CHANGE', this.onProductChange.bind(this))
      },

      async onProductChange(message: ProductChangeMessage) {
        logger?.debug(TAG, 'POS_PRODUCT_CHANGE', message)
        const data: PosData = self(this).data
        await data.read('product.product', [...message.product_ids])
      },

      /**
       * @override https://github.com/abichinger/odoo/blob/f9de1eef6dd403157c0222dc75de85c8b7b59e3c/addons/point_of_sale/static/src/app/store/pos_store.js#L590
       */
      async addLineToCurrentOrder(vals: any, opts = {}, configure = true) {
        try {
          return await super.addLineToCurrentOrder(vals, opts, configure)
        } catch (err) {
          if (err instanceof StockError) {
            const stock = useStock(getEnv())
            return stock.showErrorDialog(err.message)
          }
          throw err
        }
      },
    }
  },
})
