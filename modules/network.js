const Cinnamon = imports.gi.Cinnamon;

const _ = imports._;
const Graph = imports.graph;
const Modules = imports.modules;

const name = "network";
const display = _("Network");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    max: 1,
    maxIndex: 0,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_netload;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            up: [],
            down: []
        };

        this.data = {
            up: [],
            down: []
        };

        this.history = {
            up: [],
            down: []
        };

        this.dev = [];
        let r = Cinnamon.get_file_contents_utf8_sync("/proc/net/dev").split("\n"), s;

        for(var i = 2, l = r.length; i < l; ++i){
            s = r[i].match(/^\s*(\w+)/);
            if(s !== null){
                s = s[1];
                if(s === "lo") continue;
                this.dev.push(s);
            }
        }
    },

    getData: function(delta){
        let up = 0, down = 0;

        for(var i = 0, l = this.dev.length; i < l; ++i){
            Modules.GTop.glibtop_get_netload(this.gtop, this.dev[i]);
            up += this.gtop.bytes_out;
            down += this.gtop.bytes_in;
        }

        if(delta > 0 && this.raw.up > -1 && this.raw.down > -1){
            this.saveData("up", this.raw.up? (up - this.raw.up) / delta : 0);
            this.saveData("down", this.raw.down? (down - this.raw.down) / delta : 0);

            this.updateMinMax();
        }

        this.saveRaw("up", up);
        this.saveRaw("down", down);
    },

    panelLabel: {
        r: function(n){
            if(n === "u")
                return this.format("rate", this.data.up, true);

            if(n === "d")
                return this.format("rate", this.data.down, false);

            return false;
        }
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [130, 130],

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.settings = module.settings;

        this.addRow(_("Total"));
    },

    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.up, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.down, false);

        this.setText(1, this.settings.order? 0 : 1, "bytes", this.raw.up);
        this.setText(1, this.settings.order? 1 : 0, "bytes", this.raw.down);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(2);

        this.next("up");
        this.bar(this.data.up / this.module.max);

        this.next("down");
        this.bar(this.data.down / this.module.max);
    }
};

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.up.length, 0, this.module.max);

        this.next("up");
        this.line(this.history.up, 0, 2);

        this.next("down");
        this.line(this.history.down, 1, 2);
    }
};
