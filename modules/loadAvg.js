const _ = imports._;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "loadAvg",
    display: _("Load averages"),

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_loadavg;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = [];

        let labels = [90, 90, 80];
        this.submenu = this.buildMenuItem(this.display, labels);
    },

    getData: function(){
        GTop.glibtop_get_loadavg(this.gtop);

        this.data = this.gtop.loadavg;
    },

    update: function(){
        this.setText(0, 0, "number", this.data[0]);
        this.setText(0, 1, "number", this.data[1]);
        this.setText(0, 2, "number", this.data[2]);
    }
};
