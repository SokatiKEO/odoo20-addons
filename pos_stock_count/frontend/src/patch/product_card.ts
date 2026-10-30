import { definePatch } from 'odoo-typescript/v18'

// enable slots, otherwise owl throws an error:
// Invalid props for component 'ProductCard': unknown key 'slots'
definePatch({
  name: '@abichinger_pos_stock/product_card_props',
  deps: { card: '@point_of_sale/app/generic_components/product_card/product_card' },
  objToPatch: ({ card }) => card.ProductCard,
  patch(_, { card }) {
    return {
      props: { ...card.ProductCard.props, slots: { type: Object, optional: true } },
    }
  },
})
