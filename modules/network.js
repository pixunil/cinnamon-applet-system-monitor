const Cinnamon = imports.gi.Cinnamon;

const _ = imports._;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "network",
    display: _("Network"),

    max: 1,
    maxIndex: 0,

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_netload;
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

        let labels = [130, 130];
        this.buildSubMenu(labels);
        let r = Cinnamon.get_file_contents_utf8_sync("/proc/net/dev").split("\n"), s;
        for(var i = 2, l = r.length; i < l; ++i){
            s = r[i].match(/^\s*(\w+)/);
            if(s !== null){
                s = s[1];
                if(s === "lo") continue;
                this.dev.push(s);
            }
        }
        this.buildMenuItem(_("Total"), labels);
    },
    getData: function(delta){
        let up = 0, down = 0;

        for(var i = 0, l = this.dev.length; i < l; ++i){
            GTop.glibtop_get_netload(this.gtop, this.dev[i]);
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
    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.up, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.down, false);

        this.setText(1, this.settings.order? 0 : 1, "bytes", this.raw.up);
        this.setText(1, this.settings.order? 1 : 0, "bytes", this.raw.down);
    },
    panelLabel: {
        r: function(n){
            if(n === "u")
                return this.format("rate", this.data.up, true);

            if(n === "d")
                return this.format("rate", this.data.down, false);

            return false;
        }
    },

    menuGraph: "NetworkHistory",
    panelGraphs: ["NetworkBar", "NetworkHistory"]
};
