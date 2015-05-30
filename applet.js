const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Util = imports.misc.util;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Mainloop = imports.mainloop;

const uuid = "system-monitor@pixunil";
const path = imports.ui.appletManager.appletMeta[uuid].path;

if(imports.searchPath.indexOf(path) === -1)
    imports.searchPath.push(path);

const _ = imports._;
const bind = imports.bind;

const iconName = imports.iconName;

const Graph = imports.graph;
const Modules = imports.modules;

imports.searchPath.splice(imports.searchPath.indexOf(path), 1);

function PanelWidget(panelHeight, module, modules){
    this._init(panelHeight, module, modules);
}
PanelWidget.prototype = {
    _init: function(panelHeight, module, modules){
        this.box = new St.BoxLayout();

        this.label = new St.Label({reactive: true, track_hover: true, style_class: "applet-label"});
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.box.add(this.label, {y_align: St.Align.MIDDLE, y_fill: false});

        this.canvas = new St.DrawingArea({height: panelHeight});
        this.canvas.connect("repaint", bind(this.draw, this));
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
        if(this.module.settings[this.module.name + "PanelGraph"] === -1) return;

        let graph = this.module.settings[this.module.name + "PanelGraph"];
        if(this.module.settings[this.module.name + "PanelMode"])
            graph += this.module.settings[this.module.name + "PanelMode"];
        this.graphs[graph].draw();
    },
    paint: function(){
        this.canvas.queue_repaint();
    }
};

function SystemMonitorTooltip(){
    this._init.apply(this, arguments);
}

SystemMonitorTooltip.prototype = {
    __proto__: Tooltips.PanelItemTooltip.prototype,

    _init: function(applet, orientation){
        Tooltips.PanelItemTooltip.prototype._init.call(this, applet, "", orientation);

        this._tooltip = new St.BoxLayout({name: "Tooltip", vertical: true});
        this._tooltip.show_on_set_parent = false;
        Main.uiGroup.add_actor(this._tooltip);

        this._tooltip.get_text = function(){
            return true;
        };
    },

    addActor: function(actor){
        this._tooltip.add_actor(actor);
    }
};


function SystemMonitorApplet(orientation, panelHeight, instanceId){
    this._init(orientation, panelHeight, instanceId);
}
SystemMonitorApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panelHeight, instanceId){
        Applet.Applet.prototype._init.call(this, orientation, panelHeight);

        this.panelHeight = panelHeight;
        this._applet_tooltip = new SystemMonitorTooltip(this, orientation);
        this._applet_tooltip.addActor(new St.Label({text: _("System Monitor")}));

        this.time = [];

        this.graph = {
            submenu: new PopupMenu.PopupSubMenuMenuItem(_("Graph")),
            items: [new PopupMenu.PopupMenuItem(_("Overview")), new PopupMenu.PopupMenuItem(_("CPU History")), new PopupMenu.PopupMenuItem(_("Memory and Swap History")),
                new PopupMenu.PopupMenuItem(_("Disk History")), new PopupMenu.PopupMenuItem(_("Network History")), new PopupMenu.PopupMenuItem(_("Thermal History"))]
        };
        this.graphs = [];

        this.settings = {};
        this.colors = {};
        this.settingProvider = new Settings.AppletSettings(this.settings, uuid, instanceId);

        //Settings keys
        let keys = [
            "show-icon", "interval", "byte-unit", "rate-unit", "thermal-unit", "order",
            "graph-size", "graph-steps", "graph-overview", "graph-connection",
            "load", "color-cpu1", "color-cpu2", "color-cpu3", "color-cpu4", "cpu-split", "cpu-warning", "cpu-warning-time", "cpu-warning-mode", "cpu-warning-value",
            "color-mem", "color-swap", "mem-panel-mode",
            "color-write", "color-read", "color-up", "color-down",
            "color-thermal", "thermal-mode","thermal-warning", "thermal-warning-time", "thermal-warning-value"
        ];

        ["cpu", "mem", "disk", "network", "thermal"].forEach(function(p){
            keys.push(p, p + "-appearance", p + "-panel-label", p + "-panel-graph", p + "-panel-width");
        });

        keys.forEach(function(p){
            var q = p.replace(/-(.)/g, function(m, c){
                return c.toUpperCase();
            });

            this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q, bind(this.onSettingsChanged, this));
        }, this);

        this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph-type", "graphType", bind(this.onGraphTypeChanged, this));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.modules = {
            load: new Modules.LoadAvg(this.settings, this.colors, this.time),
            cpu: new Modules.CPU(this.settings, this.colors, this.time),
            mem: new Modules.Memory(this.settings, this.colors, this.time),
            swap: new Modules.Swap(this.settings, this.colors, this.time),
            disk: new Modules.Disk(this.settings, this.colors, this.time),
            network: new Modules.Network(this.settings, this.colors, this.time),
            thermal: new Modules.Thermal(this.settings, this.colors, this.time)
        };

        this.modules.mem.swap = this.modules.swap;

        for(let i in this.modules){
            if(!this.modules[i].unavailable){
                this.menu.addMenuItem(this.modules[i].submenu);
                this._applet_tooltip.addActor(this.modules[i].tooltip);
            }
        }

        this.initPanel();
        this.initGraphs();

        this.onGraphTypeChanged();
        this.graph.items.forEach(function(item, i){
            //To supress menu from closing
            item.activate = bind(function(){
                this.settings.graphType = i;
                this.onGraphTypeChanged();
            }, this);
            this.graph.submenu.menu.addMenuItem(item, {span: -1, expand: true});
        }, this);
        this.menu.addMenuItem(this.graph.submenu);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
        this.menu.addAction(_("System Monitor"), function(){
            let appSys = Cinnamon.AppSystem.get_default();
            let gsmApp = appSys.lookup_app("gnome-system-monitor.desktop");
            gsmApp.activate();
        });

        this.onSettingsChanged();
        this.getData();

        this.paintTimeline = new Clutter.Timeline({duration: 100, repeat_count: -1});
        this.paintTimeline.connect("new-frame", bind(this.paint, this));
        this.paintTimeline.start();
    },
    initGraphs: function(){
        this.canvas = new St.DrawingArea({height: this.settings.graphSize});
        this.canvas.connect("repaint", bind(this.draw, this));
        this.canvasHolder = new PopupMenu.PopupBaseMenuItem({activate: false, sensitive: false});
        this.canvasHolder.actor.connect("scroll-event", bind(this.onScroll, this));
        this.canvasHolder.addActor(this.canvas, {span: -1, expand: true});
        this.menu.addMenuItem(this.canvasHolder);

        let overviewGraphs = [
            new Graph.PieOverview(this.canvas, this.modules, this.time, this.settings, this.colors),
            new Graph.ArcOverview(this.canvas, this.modules, this.time, this.settings, this.colors)
        ];

        this.graphs = [overviewGraphs];

        for(let i in this.modules){
            if(this.modules[i].menuGraph)
                this.graphs.push(new Graph[this.modules[i].menuGraph](this.canvas, this.modules, this.time, this.settings, this.colors));
        }
    },

    initPanel: function(){
        this.iconBox = new St.Bin();
        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "system-status-icon"});
        this.iconBox.child = icon;
        this.actor.add(this.iconBox, {y_align: St.Align.MIDDLE, y_fill: false});

        this.panelWidgets = {};

        for(var i in this.modules){
            if(!this.modules[i].panelGraphs) continue;
            let widget = new PanelWidget(this.panelHeight, this.modules[i], this.modules);
            this.actor.add(widget.box);
            this.panelWidgets[i] = widget;
        }
    },

    getData: function(){
        let time = GLib.get_monotonic_time() / 1e6;
        let delta = time - this.time[0];
        this.time[0] = time;

        for(var i in this.modules){
            if(this.settings[this.modules[i].name])
                this.modules[i].getData(delta);
        }

        this.updateText();
        this.timeout = Mainloop.timeout_add(this.settings.interval, bind(this.getData, this));

        if(this.settings.graphType === 0)
            this.canvas.queue_repaint();
    },
    paint: function(timeline, t, once){
        //do not repaint Overview graph (it is handled by getData), but when the graphType is updated
        if(this.menu.isOpen && (this.settings.graphType !== 0 || once))
            this.canvas.queue_repaint();

        for(var i in this.panelWidgets)
            this.panelWidgets[i].paint();
    },
    draw: function(){
        if(this.settings.graphType === 0)
            this.graphs[0][this.settings.graphOverview].draw();
        else
            this.graphs[this.settings.graphType].draw();
    },
    updateText: function(){
        for(var i in this.modules){
            if(this.settings[this.modules[i].name]){
                this.modules[i]._update(this.menu.isOpen);
            }
        }
    },
    on_applet_clicked: function(){
        this.menu.toggle();
        if(this.menu.isOpen) this.updateText();
    },
    on_applet_removed_from_panel: function(){
        Mainloop.source_remove(this.timeout);
        this.paintTimeline.run_dispose();
        this.settingProvider.finalize();
    },
    onSettingsChanged: function(){
        ["cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap", "write", "read", "up", "down", "thermal"].forEach(function(p){
            let c = this.settings["color" + p[0].toUpperCase() + p.substr(1)].split(","), i;
            for(i = 0; i < 3; ++i)
                c[i] = parseInt(c[i].match(/\d+/)) / 255; //rgba[0-255] -> rgb[0-1]
            this.colors[p] = c;
        }, this);
        this.canvas.set_height(this.settings.graphSize);

        var j = 0;
        for(var i in this.modules){
            this.modules[i].onSettingsChanged();
            if(this.modules[i].menuGraph){
                this.graph.items[++j].actor.visible = !!this.settings[this.modules[i].name];
                //if the module was deactivated, but the menu graph is active, set it to "Overview"
                if(!this.settings[this.modules[i].name] && this.settings.graphType === j){
                    this.settings.graphType = 0;
                    this.onGraphTypeChanged();
                }
            }
        }

        this.iconBox.visible = this.settings.showIcon;

        this.updateText();
    },
    onGraphTypeChanged: function(){
        this.graph.items.forEach(function(item){
            item.setShowDot(false);
        });

        let show = this.settings.graphType !== -1;
        this.graph.submenu.actor.visible = show;
        this.canvasHolder.actor.visible = show;
        if(show){
            this.graph.items[this.settings.graphType].setShowDot(true);
            this.paint(this.paintTimeline, 0, true);
        }
    },
    onScroll: function(actor, event){
        let direction = event.get_scroll_direction();
        let graphType = this.settings.graphType;

        if(direction === Clutter.ScrollDirection.DOWN && graphType < this.graphs.length - 1){
            //skip not available modules
            do {
                if(++graphType === this.graphs.length)
                    return;
            } while(!this.graph.items[graphType].actor.visible);
        } else if(direction === Clutter.ScrollDirection.UP && graphType > 0){
            do {
                graphType--;
            } while(!this.graph.items[graphType].actor.visible);
        }

        this.settings.graphType = graphType;

        this.onGraphTypeChanged();
    },

    launchReadme: function(){
        Util.spawnCommandLine("xdg-open https://github.com/pixunil/cinnamon-applet-system-monitor/blob/master/README.md#settings");
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    var systemMonitorApplet;
    try {
        systemMonitorApplet = new SystemMonitorApplet(orientation, panelHeight, instanceId);
    } catch(e){
        global.logError(e);
    }
    return systemMonitorApplet;
}
