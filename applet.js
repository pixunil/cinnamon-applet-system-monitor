const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

const Graph = imports.ui.appletManager.applets[uuid].graph;
const Modules = imports.ui.appletManager.applets[uuid].modules;


function PanelWidget(panelHeight, module, modules){
    this._init(panelHeight, module, modules);
}
PanelWidget.prototype = {
    _init: function(panelHeight, module, modules){
        this.box = new St.BoxLayout();
        let tooltip = new Tooltips.Tooltip(this.box, module.display);

        this.label = new St.Label({reactive: true, track_hover: true, style_class: "applet-label"});
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.box.add(this.label, {y_align: St.Align.MIDDLE, y_fill: false});

        this.canvas = new St.DrawingArea({height: panelHeight});
        this.canvas.connect("repaint", this.draw.bind(this));
        this.box.add_actor(this.canvas);

        this.graphs = [];
        let graph;
        for(var i = 0, l = module.panelGraphs.length; i < l; ++i){
            graph = new Graph[module.panelGraphs[i]](this.canvas, modules, module.time, module.settings, module.colors);
            graph.packDir = false;
            this.graphs.push(graph);
        }

        module.panel = this;
        this.module = module;
    },
    draw: function(){
        try {
            if(this.module.settings[this.module.name + "PanelGraph"] === -1) return;

            let graph = this.module.settings[this.module.name + "PanelGraph"];
            if(this.module.settings[this.module.name + "PanelMode"])
                graph += this.module.settings[this.module.name + "PanelMode"];
            this.graphs[graph].draw();
        } catch(e){
            global.logError(e);
        }
    },
    paint: function(){
        this.canvas.queue_repaint();
    }
};


function SystemMonitorApplet(orientation, panelHeight, instanceId){
    this._init(orientation, panelHeight, instanceId);
}
SystemMonitorApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    time: [],

    graph: {
        submenu: new PopupMenu.PopupSubMenuMenuItem(_("Graph")),
        items: [new PopupMenu.PopupMenuItem(_("Overview")), new PopupMenu.PopupMenuItem(_("CPU History")), new PopupMenu.PopupMenuItem(_("Memory History")),
            new PopupMenu.PopupMenuItem(_("Disk History")), new PopupMenu.PopupMenuItem(_("Network History")), new PopupMenu.PopupMenuItem(_("Thermal History"))]
    },
    graphs: [],

    _init: function(orientation, panelHeight, instanceId){
        try {
            Applet.Applet.prototype._init.call(this, orientation, panelHeight);

            this.panelHeight = panelHeight;

            let item, i, l, j, r, s, t, _appSys = Cinnamon.AppSystem.get_default();

            this.settings = {};
            this.colors = {};
            this.settingProvider = new Settings.AppletSettings(this.settings, uuid, instanceId);
            ["interval", "byte-unit", "rate-unit", "maxsize", "order",
                "graph-overview", "graph-connection", "graph-interval", "graph-steps"].forEach(function(p){
                var q = p.replace(/-(.)/g, function(m, c){
                    return c.toUpperCase();
                });

                this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q);
            }, this);

            this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "thermal-mode", "thermalMode");

            //Settings with callback
            let keys = ["thermal-unit", "graph-size", "show-icon", "color-cpu1", "color-cpu2", "color-cpu3", "color-cpu4", "color-mem", "color-swap", "color-write", "color-read", "color-up", "color-down", "color-thermal",
                "cpu-warning", "cpu-warning-time", "cpu-warning-mode", "cpu-warning-value", "thermal-warning", "thermal-warning-time", "thermal-warning-value", "mem-panel-mode"];

            ["cpu", "mem", "disk", "network", "thermal"].forEach(function(p){
                keys.push(p + "-appearance", p + "-panel-label", p + "-panel-graph", p + "-panel-width");
            });

            keys.forEach(function(p){
                var q = p.replace(/-(.)/g, function(m, c){
                    return c.toUpperCase();
                });

                this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q, this.onSettingsChanged.bind(this));
            }, this);

            this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph-type", "graphType", this.onGraphTypeChanged.bind(this));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.modules = {
                cpu: new Modules.CPU(this.settings, this.colors, this.time),
                mem: new Modules.Memory(this.settings, this.colors, this.time),
                swap: new Modules.Swap(this.settings, this.colors, this.time),
                disk: new Modules.Disk(this.settings, this.colors, this.time),
                network: new Modules.Network(this.settings, this.colors, this.time),
                thermal: new Modules.Thermal(this.settings, this.colors, this.time)
            };

            for(i in this.modules)
                this.menu.addMenuItem(this.modules[i].submenu);

            this.initPanel();
            this.initGraphs();

            this.onGraphTypeChanged();
            this.graph.items.forEach(function(item, i){
                //To supress menu from closing
                item.activate = Lang.bind(this, function(){
                    this.settings.graphType = i;
                    this.onGraphTypeChanged();
                });
                this.graph.submenu.menu.addMenuItem(item);
            }, this);
            this.menu.addMenuItem(this.graph.submenu);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let _gsmApp = _appSys.lookup_app("gnome-system-monitor.desktop");
            item = new PopupMenu.PopupMenuItem(_("System Monitor"));
            item.connect("activate", function(){
                _gsmApp.activate();
            });
            this.menu.addMenuItem(item);

            this.onSettingsChanged();
            this.getData();
            this.paint();
        } catch(e){
            global.logError(e);
        }
    },
    initGraphs: function(){
        this.canvas = new St.DrawingArea({height: this.settings.graphSize});
        this.canvas.connect("repaint", this.draw.bind(this));
        this.canvasHolder = new PopupMenu.PopupBaseMenuItem({activate: false, sensitive: false});
        this.canvasHolder.actor.connect("scroll-event", this.onScroll.bind(this));
        this.canvasHolder.addActor(this.canvas, {span: -1, expand: true});
        this.menu.addMenuItem(this.canvasHolder);

        let overviewGraphs = [
            new Graph.PieOverview(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.ArcOverview(this.canvas, this.modules, this.time, this.settings, this.colors)
        ];

        this.graphs = [
            overviewGraphs,
            new Graph.CPUHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.MemorySwapHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.DiskHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.NetworkHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.ThermalHistory(this.canvas, this.modules, this.time, this.settings, this.colors)
        ];
    },

    initPanel: function(){
        this.set_applet_tooltip(_("System monitor"));

        this.iconBox = new St.Bin();
        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "system-status-icon"});
        this.iconBox.child = icon;
        this.actor.add(this.iconBox, {y_align: St.Align.MIDDLE, y_fill: false});

        this.panelWidgets = {};

        for(var i in this.modules){
            if(!this.modules[i].name) continue;
            let widget = new PanelWidget(this.panelHeight, this.modules[i], this.modules);
            this.actor.add(widget.box);
            this.panelWidgets[i] = widget;
        }
    },

    getData: function(){
        try {
            let time = GLib.get_monotonic_time() / 1e6;
            let delta = time - this.time[0];
            this.time[0] = time;

            for(var i in this.modules)
                this.modules[i].getData(delta);

            this.updateText();
            this.timeout = Mainloop.timeout_add(this.settings.interval, this.getData.bind(this));
        } catch(e){
            global.logError(e);
        }
    },
    paint: function(once){
        try {
            if(this.menu.isOpen)
                this.canvas.queue_repaint();

            for(var i in this.panelWidgets)
                this.panelWidgets[i].paint();

            if(!once)
                this.paintTimeout = Mainloop.timeout_add(this.settings.graphInterval, this.paint.bind(this));
        } catch(e){
            global.logError(e);
        }
    },
    draw: function(){
        try {
            if(this.settings.graphType === 0)
                this.graphs[0][this.settings.graphOverview].draw();
            else
                this.graphs[this.settings.graphType].draw();
        } catch(e){
            global.logError(e);
        }
    },
    updateText: function(){
        try {
            let tooltipText = [_("System Monitor")];
            for(var i in this.modules){
                this.modules[i]._update(this.menu.isOpen);
                tooltipText.push(this.modules[i].tooltipText.join("\t"));
            }
            this.set_applet_tooltip(tooltipText.join("\n"));
        } catch(e){
            global.logError(e);
        }
    },
    on_applet_clicked: function(){
        this.menu.toggle();
        if(this.menu.isOpen) this.updateText();
    },
    on_applet_removed_from_panel: function(){
        Mainloop.source_remove(this.timeout);
        Mainloop.source_remove(this.paintTimeout);
    },
    onSettingsChanged: function(){
        try {
            ["cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap", "write", "read", "up", "down", "thermal"].forEach(function(p){
                let c = this.settings["color" + p[0].toUpperCase() + p.substr(1)].split(","), i;
                for(i = 0; i < 3; ++i)
                    c[i] = parseInt(c[i].match(/\d+/)) / 255; //rgba[0-255] -> rgb[0-1]
                this.colors[p] = c;
            }, this);
            this.canvas.set_height(this.settings.graphSize);

            for(var i in this.modules){
                if(this.modules[i].onSettingsChanged)
                    this.modules[i].onSettingsChanged();
            }

            if(this.settings.showIcon)
                this.iconBox.show();
            else
                this.iconBox.hide();

            this.updateText();
        } catch(e){
            global.logError(e);
        }
    },
    onGraphTypeChanged: function(){
        try {
            this.graph.items.forEach(function(item){
                item.setShowDot(false);
            });

            if(this.settings.graphType === -1){
                this.graph.submenu.actor.hide();
                this.canvasHolder.actor.hide();
            } else {
                this.graph.submenu.actor.show();
                this.canvasHolder.actor.show();
                this.graph.items[this.settings.graphType].setShowDot(true);
            }
            this.paint(true);
        } catch(e){
            global.logError(e);
        }
    },
    onScroll: function(actor, event){
        try {
            let direction = event.get_scroll_direction();

            if(direction == Clutter.ScrollDirection.DOWN && this.settings.graphType < this.graphs.length - 1)
                this.settings.graphType++;
            else if(direction == Clutter.ScrollDirection.UP && this.settings.graphType > 0)
                this.settings.graphType--;

            this.onGraphTypeChanged();
        } catch(e){
            global.logError(e);
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    let systemMonitorApplet = new SystemMonitorApplet(orientation, panelHeight, instanceId);
    return systemMonitorApplet;
}
