import { definePatch } from 'odoo-typescript/v18'
import { useStock } from '../stock'
import { logger, TAG } from '../log'
import { Product } from '../types'
import { getEnv } from './pos_app'
import { getL10n } from '../util'

definePatch({
  name: 'abichinger_pos_stock/orderline',
  deps: { model: '@point_of_sale/app/models/pos_order_line' },
  objToPatch: ({ model }) => model.PosOrderline.prototype,
  patch() {
    return {
      ab_stock_warehouse_id: undefined as number | undefined,

      /**
       * @override https://github.com/abichinger/odoo/blob/f9de1eef6dd403157c0222dc75de85c8b7b59e3c/addons/point_of_sale/static/src/app/models/pos_order_line.js#L294
       */
      can_be_merged_with(orderline: any) {
        return (
          this.ab_stock_warehouse_id == orderline.ab_stock_warehouse_id &&
          super.can_be_merged_with(orderline)
        )
      },

      /**
       * @override https://github.com/abichinger/odoo/blob/f9de1eef6dd403157c0222dc75de85c8b7b59e3c/addons/point_of_sale/static/src/app/models/pos_order_line.js#L195
       */
      set_quantity(quantity: number, keep_price: boolean) {
        const stock = useStock(getEnv())
        const product: Product = (this as any).product_id
        if (stock.shouldDeny(product, quantity)) {
          const { _t } = getL10n()
          return {
            title: _t('Selling not allowed'),
            body: stock.denyMessage(product),
          }
        }

        return super.set_quantity(quantity, keep_price)
      },
    }
  },
})

definePatch({
  name: 'abichinger_pos_stock/pos_data',
  deps: { data: '@point_of_sale/app/models/data_service' },
  objToPatch: ({ data }) => data.PosData.prototype,
  patch(self) {
    return {
      /**
       * @override https://github.com/abichinger/odoo/blob/a84c951a52269379c0c7e1b4090e7234bf29e855/addons/point_of_sale/static/src/app/models/data_service.js#L197
       */
      async initData() {
        await super.initData()
        this.patchOrderLineCreate()
      },

      patchOrderLineCreate() {
        const model = self(this).models['pos.order.line']

        const create_patch = (create: any) => {
          return (
            vals: any,
            ignoreRelations = false,
            fromSerialized = false,
            delayedSetup = false,
          ) => {
            logger?.debug(TAG, 'patched create')
            const stock = useStock(getEnv())
            const product_id: Product = vals.product_id
            stock.assertStock(product_id, vals.qty)
            return create(vals, ignoreRelations, fromSerialized, delayedSetup)
          }
        }

        model.create = create_patch(model.create.bind(model))
      },
    }
  },
})
