const _ = imports._;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "mem",
    display: _("Memory"),

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_mem;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0,
            usedup: 0,
            cached: 0,
            buffer: 0
        };
        this.history = {
            usedup: [],
            cached: [],
            buffer: []
        };

        let labels = [100, 100, 60];
        this.buildSubMenu(labels);
        this.buildMenuItem(_("used"), labels);
        this.buildMenuItem(_("cached"), labels);
        this.buildMenuItem(_("buffered"), labels);
    },

    getData: function(){
        GTop.glibtop_get_mem(this.gtop);

        this.saveData("total", this.gtop.total);
        this.saveData("used", this.gtop.used);
        this.saveData("usedup", this.gtop.used - this.gtop.cached - this.gtop.buffer);
        this.saveData("cached", this.gtop.cached);
        this.saveData("buffer", this.gtop.buffer);
    },

    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);

        this.setText(1, 0, "bytes", this.data.usedup);
        this.setText(1, 2, "percent", this.data.usedup, this.data.total);

        this.setText(2, 0, "bytes", this.data.cached);
        this.setText(2, 2, "percent", this.data.cached, this.data.total);

        this.setText(3, 0, "bytes", this.data.buffer);
        this.setText(3, 2, "percent", this.data.buffer, this.data.total);
    },

    panelLabel: {
        _mem: {
            u: "usedup",
            U: "used",
            c: "cached",
            b: "buffer",
            t: "total"
        },

        _swap: {
            u: "used",
            t: "total"
        },

        m: function(n){
            if(this.panelLabel._mem[n])
                return this.format("bytes", this.data[this.panelLabel._mem[n]]);

            return false;
        },

        s: function(n){
            if(n === "p")
                return this.format("percent", this.swap.data.used, this.swap.data.total);

            if(this.panelLabel._swap[n])
                return this.format("bytes", this.swap.data[this.panelLabel._swap[n]]);

            return false;
        },

        p: function(n){
            if(this.panelLabel._mem[n])
                return this.format("percent", this.data[this.panelLabel._mem[n]], this.data.total);

            return false;
        }
    },

    menuGraph: "MemorySwapHistory",
    panelGraphs: ["MemoryBar", "MemoryHistory", "MemorySwapBar", "MemorySwapHistory"]
};
