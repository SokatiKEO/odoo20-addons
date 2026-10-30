import { definePatch } from 'odoo-typescript/v18'
import { ProductStockWidget } from '../stock'

// add ProductStockWidget to ProductScreen
definePatch({
  name: '@abichinger_pos_stock/product_screen',
  deps: { screen: '@point_of_sale/app/screens/product_screen/product_screen' },
  objToPatch: ({ screen }) => screen.ProductScreen,
  patch(_, { screen }) {
    return {
      components: { ...screen.ProductScreen.components, ProductStockWidget },
    }
  },
})
