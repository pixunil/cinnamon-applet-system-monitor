const _ = imports._;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "swap",
    settingsName: "mem",
    display: _("Swap"),

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_swap;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0
        };

        this.history = {
            used: []
        };

        let labels = [100, 100, 60];
        this.submenu = this.buildMenuItem(this.display, labels);
    },

    getData: function(){
        GTop.glibtop_get_swap(this.gtop);

        this.saveData("total", this.gtop.total);
        this.saveData("used", this.gtop.used);
    },

    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);
    },

    // will handled by Memory
    onSettingsChanged: function(){}
};
