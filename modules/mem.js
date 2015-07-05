const _ = imports._;
const Graph = imports.graph;
const Modules = imports.modules;

const name = "mem";
const display = _("Memory");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_mem;
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
    },

    getData: function(){
        Modules.GTop.glibtop_get_mem(this.gtop);

        this.saveData("total", this.gtop.total);
        this.saveData("used", this.gtop.used);
        this.saveData("usedup", this.gtop.used - this.gtop.cached - this.gtop.buffer);
        this.saveData("cached", this.gtop.cached);
        this.saveData("buffer", this.gtop.buffer);
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [100, 100, 60],

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("used"));
        this.addRow(_("cached"));
        this.addRow(_("buffered"));
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
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.ModulePartPrototype,

    mem: {
        u: "usedup",
        U: "used",
        c: "cached",
        b: "buffer",
        t: "total"
    },

    swap: {
        u: "used",
        t: "total"
    },

    m: function(n){
        if(this.mem[n])
            return this.format("bytes", this.data[this.mem[n]]);

        return false;
    },

    s: function(n){
        if(n === "p")
            return this.format("percent", this.swap.data.used, this.swap.data.total);

        if(this.swap[n])
            return this.format("bytes", this.swap.data[this.swap[n]]);

        return false;
    },

    p: function(n){
        if(this.mem[n])
            return this.format("percent", this.data[this.mem[n]], this.data.total);

        return false;
    }
}

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        if(this.settings.memPanelMode === 0)
            this.begin(1);
        else
            this.begin(2);

        this.next("mem");
        this.bar(this.data.usedup / this.data.total);

        this.setAlpha(.75);
        this.bar(this.data.cached / this.data.total);

        this.setAlpha(.5);
        this.bar(this.data.buffer / this.data.total);

        if(this.settings.memPanelMode === 2){
            this.next("swap");
            this.bar(this.module.swap.data.used / this.module.swap.data.total);
        }
    }
};

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.usedup.length, 0, this.data.total);

        let num = this.settings.memPanelMode === 0? 1 : 2;

        this.next("mem");
        this.line(this.history.usedup, 0, num);

        this.setAlpha(.75);
        this.line(this.history.cached, 0, num);

        this.setAlpha(.5);
        this.line(this.history.buffer, 0, num);

        if(this.settings.memPanelMode === 2){
            this.max = this.module.swap.data.total;

            this.next("swap");
            this.line(this.module.swap.history.used, 1, 2);
        }
    }
};
