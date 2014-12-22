const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const Lang = imports.lang;

const messageTray = Main.messageTray;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

const Terminal = imports.ui.appletManager.applets[uuid].terminal;

try {
    const GTop = imports.gi.GTop;
} catch(e){
    let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
    Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
        "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
        "\tFedora: libgtop2-devel\n" +
        "\tArch: libgtop\n" +
        "to use the applet " + uuid), icon);
}

function getProperty(obj, str){
    str += "";
    if(str === "") return obj;
    var res = obj;
    str = str.split(".");
    for(var i = 0, l = str.length; i < l; ++i){
        if(!res[str[i]]) return null;
        res = res[str[i]];
    }
    return res;
}

function setProperty(obj, str, value){
    var res = obj;
    str = (str + "").split(".");
    for(var i = 0, l = str.length - 1; i < l; ++i)
        res = res[str[i]];
    res[str[i]] = value;
}

function Base(settings, colors, time){
    this._init(settings, colors, time);
}

Base.prototype = {
    _init: function(settings, colors, time){
        this.settings = settings;
        this.colors = colors;
        this.time = time;
        this.container = [];
        this.build();
    },

    saveRawPoint: function(name, value){
        setProperty(this.raw, name, value);
    },
    saveDataPoint: function(name, value, raw){
        setProperty(this.data, name, value);

        let history;
        if(!!(history = getProperty(this.history, name))){
            history.push(value);
            while(history.length > this.settings.graphSteps + 2)
                history.shift();
        }

        if(raw)
            setProperty(this.raw, name, raw);
    },

    buildMenuItem: function(name, labels, margin){
        let item = new PopupMenu.PopupMenuItem(name, {reactive: false});
        let box = new St.BoxLayout({margin_left: margin || 0});
        item.addActor(box);
        this.container.push(box);

        for(var i = 0, l = labels.length; i < l; ++i)
            box.add_actor(new St.Label({width: labels[i], style: "text-align: right"}));

        if(this.submenu)
            this.submenu.menu.addMenuItem(item);
        return item;
    },
    buildSubMenu: function(labels, margin){
        this.submenu = new PopupMenu.PopupSubMenuMenuItem(this.display);
        let box = new St.BoxLayout({margin_left: margin || 0});
        this.submenu.addActor(box);
        this.container.push(box);

        for(var i = 0, l = labels.length; i < l; ++i)
            box.add_actor(new St.Label({width: labels[i], style: "text-align: right"}));
    },

    _update: function(menuOpen){
        this.menuOpen = menuOpen;
        this.panelText = [];
        this.tooltipText = [this.display];
        this.update();

        if(this.panel){
            this.panel.label.set_text(this.panelText.join(" "));
            this.panel.label.set_margin_left(this.panelText.length? 6 : 0);
        }
        delete this.menuOpen;
    },
    setText: function(container, label, format, value, ext){
        if(container === -1 && (!this.panel || this.settings[this.name + "PanelLabel"] === -1)) return;

        value = value || 0;
        if(format === "rate") value = this.formatRate(value, ext);
        if(format === "percent") value = this.formatPercent(value, ext);
        if(format === "thermal") value = this.formatThermal(value);
        if(format === "bytes") value = this.formatBytes(value);

        if(container === -1)
            this.panelText[label] = value;
        if(container === 0)
            this.tooltipText[label + 1] = value;
        if(container > -1 && this.menuOpen)
            this.container[container].get_children()[label].set_text(value);
    },

    notify: function(summary, body){
        let source = new MessageTray.SystemNotificationSource();
        messageTray.add(source);

        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});

        let notification = new MessageTray.Notification(source, summary, body, {icon: icon});
        notification.setTransient(true);
        source.notify(notification);
    },
    formatBytes: function(bytes){
        let prefix = " KMGTPEZY";
        let a = 1, j = 0;
        while(bytes / a > this.settings.maxsize){
            a *= this.settings.byteUnit? 1024 : 1000;
            ++j;
        }
        return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.byteUnit && j? "i" : "") + "B";
    },
    formatRate: function(bytes, dir){
        let prefix = " KMGTPEZY";
        let a = (this.settings.rateUnit < 2? 1 : .125), j = 0;
        while(bytes / a > this.settings.maxsize){
            a *= this.settings.rateUnit & 1? 1024 : 1000;
            ++j;
        }
        return (bytes / a).toFixed(1) + " " + prefix[j] + (this.settings.rateUnit & 1 && j? "i" : "") + (this.settings.rateUnit < 2? "B" : "bit") + "/s " + (dir? "\u25B2" : "\u25BC");
    },
    formatPercent: function(part, total){
        return (100 * part / (total || 1)).toFixed(1) + "%";
    },
    formatThermal: function(celsius){
        return (this.settings.thermalUnit? celsius : celsius * 1.8 + 32).toFixed(1) + "\u00b0" + (this.settings.thermalUnit? "C" : "F");
    },

    onSettingsChanged: function(){
        if(this.unavailable)
            this.settings[this.name] = false;

        this.submenu.actor.visible = !!this.settings[this.name];

        if(!this.panel) return;

        this.panel.box.visible = this.settings[this.name] && (this.settings[this.name + "PanelLabel"] !== -1 || this.settings[this.name + "PanelGraph"] !== -1);

        this.panel.label.visible = this.settings[this.name] && this.settings[this.name + "PanelLabel"] !== -1;

        this.panel.canvas.width = this.settings[this.name + "PanelWidth"];
        this.panel.canvas.visible = this.settings[this.name] && this.settings[this.name + "PanelGraph"] !== -1;
    }
};


function CPU(settings, colors, time){
    this._init(settings, colors, time);
}

CPU.prototype = {
    __proto__: Base.prototype,

    name: "cpu",
    display: _("CPU"),

    gtop: new GTop.glibtop_cpu(),

    raw: {
        total: [],
        user: [],
        system: []
    },
    data: {
        usage: [],
        user: [],
        system: []
    },
    history: {
        user: [],
        system: []
    },

    count: GTop.glibtop_get_sysinfo().ncpu,

    build: function(){
        let labels = [], margin = 260 - this.count * 60;
        GTop.glibtop_get_cpu(this.gtop);
        for(var i = 0; i < this.count; ++i){
            this.history.user.push([]);
            this.history.system.push([]);
            this.saveRawPoint("total." + i, this.gtop.xcpu_total[i]);
            this.saveRawPoint("user." + i, this.gtop.xcpu_user[i]);
            this.saveRawPoint("system." + i, this.gtop.xcpu_sys[i]);

            labels.push(60);
        }
        this.buildSubMenu(labels, margin);
        this.buildMenuItem(_("User"), labels, margin);
        this.buildMenuItem(_("System"), labels, margin);
    },
    getData: function(){
        GTop.glibtop_get_cpu(this.gtop);
        var dtotal, duser, dsystem, r = 0;
        for(var i = 0; i < this.count; ++i){
            dtotal = this.gtop.xcpu_total[i] - this.raw.total[i];
            duser = this.gtop.xcpu_user[i] - this.raw.user[i];
            dsystem = this.gtop.xcpu_sys[i] - this.raw.system[i];

            this.saveRawPoint("total." + i, this.gtop.xcpu_total[i]);
            this.saveDataPoint("user." + i, duser / dtotal, this.gtop.xcpu_user[i]);
            this.saveDataPoint("system." + i, dsystem / dtotal, this.gtop.xcpu_sys[i]);
            this.saveDataPoint("usage." + i, (duser + dsystem) / dtotal);

            if(this.settings.cpuWarning){
                if(this.settings.cpuWarningMode)
                    r += this.data.usage[i];
                else {
                    if(this.data.usage[i] >= this.settings.cpuWarningValue / 100){
                        if(--this.notifications[i] === 0)
                            this.notify("Warning:", "CPU core " + (i + 1) + " usage was over " + this.settings.cpuWarningValue + "% for " + this.settings.cpuWarningTime * this.settings.interval / 1000 + "sec");
                    } else
                        this.notifications[i] = this.settings.cpuWarningTime;
                }
            }
        }

        if(this.settings.cpuWarning && this.settings.cpuWarningMode){
                if(r / this.count >= this.settings.cpuWarningValue / 100){
                    if(--this.notifications === 0)
                        this.notify("Warning:", "CPU usage was over " + this.settings.cpuWarningValue + "% for " + this.settings.cpuWarningTime * this.settings.interval / 1000 + "sec");
                } else
                    this.notifications = this.settings.cpuWarningTime;
            }
    },
    update: function(){
        let r = 0;
        for(var i = 0; i < this.count; ++i){
            this.setText(0, i, "percent", this.data.usage[i]);
            this.setText(1, i, "percent", this.data.user[i]);
            this.setText(2, i, "percent", this.data.system[i]);

            if(this.settings.cpuPanelLabel === 0)
                r += this.data.usage[i];
            else if(this.settings.cpuPanelLabel === 1)
                this.setText(-1, i, "percent", this.data.usage[i]);
        }

        if(this.settings.cpuPanelLabel === 0)
            this.setText(-1, 0, "percent", r / this.count);
    },
    onSettingsChanged: function(){
        Base.prototype.onSettingsChanged.call(this);
        if(this.settings.cpuWarning){
            if(this.settings.cpuWarningMode)
                this.notifications = this.settings.cpuWarningTime;
            else {
                this.notifications = [];
                for(var i = 0; i < this.count; ++i)
                    this.notifications.push(this.settings.cpuWarningTime);
            }
        }
    },

    menuGraph: "CPUHistory",
    panelGraphs: ["CPUBar", "CPUHistory"]
};


function Memory(settings, colors, time){
    this._init(settings, colors, time);
}

Memory.prototype = {
    __proto__: Base.prototype,

    name: "mem",
    display: _("Memory"),

    gtop: new GTop.glibtop_mem(),

    data: {
        total: 1,
        used: 0,
        usedup: 0,
        cached: 0,
        buffer: 0
    },
    history: {
        usedup: [],
        cached: [],
        buffer: []
    },

    build: function(){
        let labels = [100, 100, 60];
        this.buildSubMenu(labels);
        this.buildMenuItem(_("used"), labels);
        this.buildMenuItem(_("cached"), labels);
        this.buildMenuItem(_("buffered"), labels);
    },
    getData: function(){
        GTop.glibtop_get_mem(this.gtop);

        this.saveDataPoint("total", this.gtop.total);
        this.saveDataPoint("used", this.gtop.used);
        this.saveDataPoint("usedup", this.gtop.used - this.gtop.cached - this.gtop.buffer);
        this.saveDataPoint("cached", this.gtop.cached);
        this.saveDataPoint("buffer", this.gtop.buffer);
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

        this.setText(-1, 2, "percent", this.data.usedup, this.data.total);
    },

    menuGraph: "MemorySwapHistory",
    panelGraphs: ["MemoryBar", "MemoryHistory", "MemorySwapBar", "MemorySwapHistory"]
};


function Swap(settings, colors, time){
    this._init(settings, colors, time);
}

Swap.prototype = {
    __proto__: Base.prototype,

    name: "mem",
    display: _("Swap"),

    gtop: new GTop.glibtop_swap(),

    data: {
        total: 1,
        used: 0
    },
    history: {
        used: []
    },

    build: function(){
        let labels = [100, 100, 60];
        this.submenu = this.buildMenuItem(this.display, labels);
    },
    getData: function(){
        GTop.glibtop_get_swap(this.gtop);

        this.saveDataPoint("total", this.gtop.total);
        this.saveDataPoint("used", this.gtop.used);
    },
    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);
    }
};


function Disk(settings, colors, time){
    this._init(settings, colors, time);
}

Disk.prototype = {
    __proto__: Base.prototype,

    gtop: new GTop.glibtop_fsusage(),

    name: "disk",
    display: _("Disk"),

    raw: {
        write: 0,
        read: 0
    },
    data: {
        write: 0,
        read: 0
    },
    history: {
        write: [],
        read: []
    },
    dev: [],

    max: 1,
    maxIndex: 0,

    build: function(){
        let labels = [130, 130];
        this.buildSubMenu(labels);
        labels = [100, 100, 60];
        let mountFile = Cinnamon.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        var mount;
        for(let mountLine in mountFile){
            mount = mountFile[mountLine].split(" ");
            if(mount[0].indexOf("/dev/") == 0){
                GTop.glibtop_get_fsusage(this.gtop, mount[1]);
                this.dev.push({
                    path: mount[1],
                    size: this.gtop.block_size,
                    free: this.gtop.bfree,
                    blocks: this.gtop.blocks
                });
                this.buildMenuItem(mount[1], labels);
            }
        }
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
            this.saveDataPoint("write", (write - this.raw.write) / delta);
            this.saveDataPoint("read", (read - this.raw.read) / delta);

            if(this.max <= this.data.write){
                this.max = this.data.write;
                this.maxIndex = 0;
            }

            if(this.max <= this.data.read){
                this.max = this.data.read;
                this.maxIndex = 0;
            }

            if(++this.maxIndex > this.settings.graphSteps + 1){
                this.max = Math.max(this.data.write, this.data.read, 1);
                this.maxIndex = 0;
                var l;
                for(i = 1, l = this.history.write.length; i < l; ++i){
                    if(this.max < this.history.write[i]){
                        this.max = this.history.write[i];
                        this.maxIndex = i;
                    }
                    if(this.max < this.history.read[i]){
                        this.max = this.history.read[i];
                        this.maxIndex = i;
                    }
                }
            }
        }

        this.saveRawPoint("write", write);
        this.saveRawPoint("read", read);
    },
    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.write, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.read, false);

        for(var i = 0; i < this.dev.length; ++i){
            this.setText(i + 1, 0, "bytes", (this.dev[i].blocks - this.dev[i].free) * this.dev[i].size);
            this.setText(i + 1, 1, "bytes", this.dev[i].blocks * this.dev[i].size);
            this.setText(i + 1, 2, "percent", this.dev[i].blocks - this.dev[i].free, this.dev[i].blocks);
        }

        this.setText(-1, this.settings.order? 0 : 1, "rate", this.data.write, true);
        this.setText(-1, this.settings.order? 1 : 0, "rate", this.data.read, false);
    },

    menuGraph: "DiskHistory",
    panelGraphs: ["DiskBar", "DiskHistory"]
};


function Network(settings, colors, time){
    this._init(settings, colors, time);
}

Network.prototype = {
    __proto__: Base.prototype,

    name: "network",
    display: _("Network"),

    gtop: new GTop.glibtop_netload(),

    raw: {
        up: [],
        down: []
    },
    data: {
        up: [],
        down: []
    },
    history: {
        up: [],
        down: []
    },

    dev: [],

    max: 1,
    maxIndex: 0,

    build: function(){
        let labels = [130, 130];
        this.buildSubMenu(labels);
        let r = Cinnamon.get_file_contents_utf8_sync('/proc/net/dev').split("\n"), s;
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
            this.saveDataPoint("up", this.raw.up? (up - this.raw.up) / delta : 0);
            this.saveDataPoint("down", this.raw.down? (down - this.raw.down) / delta : 0);

            if(this.max <= this.data.up){
                this.max = this.data.up;
                this.maxIndex = 0;
            }

            if(this.max <= this.data.down){
                this.max = this.data.down;
                this.maxIndex = 0;
            }

            if(++this.maxIndex > this.settings.graphSteps + 1){
                this.max = Math.max(this.data.up, this.data.down, 1);
                this.maxIndex = 0;
                for(i = 1, l = this.history.up.length; i < l; ++i){
                    if(this.max < this.history.up[i]){
                        this.max = this.history.up[i];
                        this.maxIndex = i;
                    }
                    if(this.max < this.history.down[i]){
                        this.max = this.history.down[i];
                        this.maxIndex = i;
                    }
                }
            }
        }

        this.saveRawPoint("up", up);
        this.saveRawPoint("down", down);
    },
    update: function(){
        this.setText(0, this.settings.order? 0 : 1, "rate", this.data.up, true);
        this.setText(0, this.settings.order? 1 : 0, "rate", this.data.down, false);

        this.setText(1, this.settings.order? 0 : 1, "bytes", this.raw.up);
        this.setText(1, this.settings.order? 1 : 0, "bytes", this.raw.down);

        this.setText(-1, this.settings.order? 0 : 1, "rate", this.data.up, true);
        this.setText(-1, this.settings.order? 1 : 0, "rate", this.data.down, false);
    },

    menuGraph: "NetworkHistory",
    panelGraphs: ["NetworkBar", "NetworkHistory"]
};


function Thermal(settings, colors, time){
    this._init(settings, colors, time);
}

Thermal.prototype = {
    __proto__: Base.prototype,

    name: "thermal",
    display: _("Thermal"),

    sensors: [],
    colorRef: [],
    path: "",

    data: [],
    history: [[]],

    min: null,
    max: null,

    build: function(){
        let labels = [80], margin = 180;
        this.buildSubMenu(labels, 180);
        let r = GLib.spawn_command_line_sync("which sensors");
        if(r[0] && r[3] == 0){
            this.path = r[1].toString().split("\n", 1)[0];
            r = GLib.spawn_command_line_sync(this.path)[1].toString().split("\n");
            for(var i = 0, l = r.length, s; i < l; ++i){
                if(r[i].substr(0, 8) == "Adapter:" && !r[i].match(/virtual/i)){
                    s = r[i].substr(9);
                    for(++i; r[i] && r[i].substr(0, 8) != "Adapter:"; ++i){
                        if(r[i].match(/\d+.\d+\xb0C/)){
                            t = r[i].match(/[^:]+/)[0];

                            if((j = t.match(/core\s*(\d)/i)) !== null) this.colorRef.push(parseInt(j[1]) % 4 + 1);
                            else this.colorRef.push(null);

                            this.buildMenuItem(t, labels, margin);
                            this.sensors.push(i);
                            this.history.push([]);
                        }
                    }
                }
            }
        }
        if(!this.sensors.length)
            this.unavailable = true;
    },
    getData: function(){
        let terminal = new Terminal.TerminalReader(this.path, this.parseResult.bind(this));
        terminal.executeReader();
    },
    parseResult: function(command, sucess, result){
        this.time[1] = GLib.get_monotonic_time() / 1e6;

        result = result.split("\n");
        let temp = 0;
        for(var i = 0, l = this.sensors.length; i < l; ++i){
            this.saveDataPoint(i + 1, parseFloat(result[this.sensors[i]].match(/\d+\.\d+/)));
            if(this.min > this.data[i + 1] || !this.min) this.min = this.data[i + 1];
            if(this.max < this.data[i + 1] || !this.max) this.max = this.data[i + 1];

            if(this.settings.thermalMode === 0 && temp > this.data[i + 1] || temp == 0) temp = this.data[i + 1];
            else if(this.settings.thermalMode === 1) temp += this.data[i + 1];
            else if(this.settings.thermalMode === 2 && temp < this.data[i + 1]) temp = this.data[i + 1];
        }
        if(this.settings.thermalMode === 1) temp /= l;
        this.saveDataPoint("0", temp);

        if(this.settings.thermalWarning && temp > this.settings.thermalWarningValue){
            if(--this.notifications === 0)
                this.notify("Warning:", "Temperature was over " + this.formatThermal(this.settings.thermalWarningValue) + " for " + this.settings.thermalWarningTime * this.settings.interval / 1000 + "sec");
        } else
            this.notifications = this.settings.thermalWarningTime;
    },
    update: function(){
        for(var i = 0, l = this.data.length; i < l; ++i)
            this.setText(i, 0, "thermal", this.data[i]);

        this.setText(-1, 0, "thermal", this.data[0]);
    },
    onSettingsChanged: function(){
        Base.prototype.onSettingsChanged.call(this);
        if(this.settings.thermalWarning){
            this.notifications = this.settings.thermalWarningTime;
            if(!this.settings.thermalUnit) this.settings.thermalWarningValue = (this.settings.thermalWarningValue - 32) * 5 / 9; //Fahrenheit => Celsius
        }
    },

    menuGraph: "ThermalHistory",
    panelGraphs: ["ThermalBar", "ThermalHistory"]
};
