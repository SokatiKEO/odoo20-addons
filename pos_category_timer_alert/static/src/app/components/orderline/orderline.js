import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_enterprise/app/components/orderline/orderline";
import { proxy, onWillUnmount } from "@odoo/owl";

patch(Orderline.prototype, {
    setup() {
        super.setup();
        this.state = proxy({
            duration: this.preparation_line?.computeFormattedDuration() || "00s",
            timerParts: this.preparation_line?.computeTimerParts() || [{ val: "00", unit: "s" }],
            isAlert: Boolean(this.preparation_line?.computeIsAlert()),
        });

        this._updateLineState();

        this.lineTimerInterval = setInterval(() => {
            if (this.preparation_line) {
                this._updateLineState();
            } else {
                clearInterval(this.lineTimerInterval);
            }
        }, 1000);

        onWillUnmount(() => {
            clearInterval(this.lineTimerInterval);
        });
    },

    _updateLineState() {
        if (!this.preparation_line) {
            return;
        }
        this.state.duration = this.preparation_line.computeFormattedDuration();
        this.state.timerParts = this.preparation_line.computeTimerParts();
        this.state.isAlert = this.preparation_line.computeIsAlert();
    },

    get categoryAlertTimer() {
        return this.preparation_line?.alertTimer || 0;
    },

    get hasTimer() {
        if (this.preparation_line?.isCancelled) {
            return false;
        }
        return (
            this.categoryAlertTimer > 0 ||
            Boolean(this.preparation_line?.stage_id?.alert_timer > 0) ||
            this.state.isAlert
        );
    },
});
