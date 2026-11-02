import { Base } from "@point_of_sale/app/models/related_models";
import { registry } from "@web/core/registry";

export class PosPrepDisplay extends Base {
    static pythonModel = "pos.prep.display";
}

registry.category("pos_available_models").add(PosPrepDisplay.pythonModel, PosPrepDisplay);

