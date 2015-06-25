const Cinnamon = imports.gi.Cinnamon;

const Mainloop = imports.mainloop;

const _ = imports._;
const Graph = imports.graph;
const bind = imports.bind;
const Base = imports.modules.Base;
const GTop = imports.modules.GTop;

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    __proto__: Base.prototype,

    name: "disk",
    display: _("Disk"),

    max: 1,
    maxIndex: 0,

    init: function(){
        Base.prototype.init.apply(this, arguments);

        try {
            this.gtop = new GTop.glibtop_fsusage;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            write: 0,
            read: 0
        };
        this.data = {
            write: 0,
            read: 0
        };
        this.history = {
            write: [],
            read: []
        };

        this.buildSubMenu([130, 130]);

        this.updateDevices();
    },

    updateDevices: function(){
        this.container.splice(1, this.container.length - 1);
        this.submenu.menu.removeAll();
        this.dev = [];

        let mountFile = Cinnamon.get_file_contents_utf8_sync("/etc/mtab").split("\n");
        for(let mountLine in mountFile){
            let mount = mountFile[mountLine].split(" ");
            if(mount[0].indexOf("/dev/") === 0){
                GTop.glibtop_get_fsusage(this.gtop, mount[1]);
                this.dev.push({
                    path: mount[1],
                    size: this.gtop.block_size,
                    free: this.gtop.bfree,
                    blocks: this.gtop.blocks
                });
                this.buildMenuItem(mount[1], [100, 100, 60]);
            }
        }

        Mainloop.timeout_add(30000, bind(this.updateDevices, this));
    },

    getData: function(delta){
        let write = 0, read = 0;

        for(var i = 0; i < this.dev.length; ++i){
            GTop.glibtop_get_fsusage(this.gtop, this.dev[i].path);

            this.dev[i].size = this.gtop.block_size;
            this.dev[i].free = this.gtop.bfree;
            this.dev[i].blocks = this.gtop.blocks;

            write += this.gtop.write * this.dev[i].size;
            read += this.gtop.read * this.dev[i].size;
        }

        if(delta > 0 && this.raw.write && this.raw.read){
            this.saveData("write", (write - this.raw.write) / delta);
            this.saveData("read", (read - this.raw.read) / delta);

            this.updateMinMax();
        }

        this.saveRaw("write", write);
        this.saveRaw("read", read);
    },

    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.write, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.read, false);

        for(var i = 0; i < this.dev.length; ++i){
            this.setText(i + 1, 0, "bytes", (this.dev[i].blocks - this.dev[i].free) * this.dev[i].size);
            this.setText(i + 1, 1, "bytes", this.dev[i].blocks * this.dev[i].size);
            this.setText(i + 1, 2, "percent", this.dev[i].blocks - this.dev[i].free, this.dev[i].blocks);
        }
    },

    panelLabel: {
        r: function(n){
            if(n === "w")
                return this.format("rate", this.data.write, true);
            if(n === "r")
                return this.format("rate", this.data.read, false);
            return false;
        }
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}
BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(2);

        this.next("write");
        this.bar(this.data.write / this.module.max);

        this.next("read");
        this.bar(this.data.read / this.module.max);
    }
};

function HistoryGraph(){
    this.init.apply(this, arguments);
}
HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.write.length, 0, this.module.max);

        this.next("write");
        this.line(this.history.write, 0, 2);

        this.next("read");
        this.line(this.history.read, 1, 2);
    }
};
