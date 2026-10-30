import * as odoo from 'odoo-typescript/v18'

export function getL10n() {
  return odoo.require('@web/core/l10n/translation')
}

export function useRender() {
  const { useState } = odoo.require('@odoo/owl')
  const state = useState({
    counter: 0,
  })
  console.log(state.counter)

  return {
    forceUpdate: () => {
      state.counter = state.counter + 1
    },
  }
}
