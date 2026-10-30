import { definePatch } from 'odoo-typescript/v18'
import { OdooEnv } from 'odoo-typescript/v18/dist/addons/web/env'

let _env: OdooEnv

definePatch({
  name: '@abichinger_pos_stock/pos_app',
  deps: { app: '@point_of_sale/app/pos_app' },
  objToPatch: ({ app }) => app.Chrome.prototype,
  patch() {
    return {
      /**
       * @override https://github.com/abichinger/odoo/blob/f9de1eef6dd403157c0222dc75de85c8b7b59e3c/addons/point_of_sale/static/src/app/pos_app.js#L18
       */
      setup() {
        _env = (this as any).env
        super.setup()
      },
    }
  },
})

export function getEnv() {
  return _env
}
