const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

const Graph = imports.ui.appletManager.applets[uuid].graph;
const Modules = imports.ui.appletManager.applets[uuid].modules;


function PanelWidget(panelHeight, modules, settings, colors, name){
	this._init(panelHeight, modules, settings, colors, name);
}
PanelWidget.prototype = {
	_init: function(panelHeight, modules, settings, colors, name){
		this.name = name;
		this.canvas = new St.DrawingArea({width: settings["panel" + name + "Width"], height: panelHeight, margin_left: 2});
		this.canvas.connect("repaint", this.draw.bind(this));
		if(settings["panel" + name + "Graph"] === -1)
			this.canvas.hide();
		this.graphs = [];

		this.modules = modules;
		this.settings = settings;
		this.colors = colors;
	},
	update: function(){
		this.canvas.set_width(this.settings["panel" + this.name + "Width"]);
		if(this.settings["panel" + this.name + "Graph"] !== -1)
			this.canvas.show();
		else
			this.canvas.hide();
	},
	addGraph: function(graphClass){
		let graph = new graphClass(this.canvas, this.modules, this.settings, this.colors);
		graph.packDir = false;
		this.graphs.push(graph);
	},
	draw: function(){
		let graph = this.settings["panel" + this.name + "Graph"];
		if(this.settings["panel" + this.name + "Mode"])
			graph += this.settings["panel" + this.name + "Mode"];
		this.graphs[graph].draw();
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
		items: [new PopupMenu.PopupMenuItem(_("Pie")), new PopupMenu.PopupMenuItem(_("Arc")), new PopupMenu.PopupMenuItem(_("CPU History")), new PopupMenu.PopupMenuItem(_("Memory History")),
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
			this.notifications = {};
			this.settingProvider = new Settings.AppletSettings(this.settings, uuid, instanceId);
			["interval", "byte-unit", "rate-unit", "maxsize", "order",
				"graph-appearance", "graph-connection", "graph-interval", "graph-steps"].forEach(function(p){
				var q = p.replace(/-(.)/g, function(m, c){
					return c.toUpperCase();
				});

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q);
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "thermal-mode", "thermalMode");

			//Settings with callback
			["thermal-unit", "graph-size", "thermal", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap",
				"cpu-warning", "cpu-warning-time", "cpu-warning-mode", "cpu-warning-value", "thermal-warning", "thermal-warning-time", "thermal-warning-value"].forEach(function(p){
				var q = p.replace(/-(.)/g, function(m, c){
					return c.toUpperCase();
				});

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, q, this.onSettingsChanged.bind(this));
			}, this);

			this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph-type", "graphType", this.onGraphTypeChanged.bind(this));

			//Panel settings
			["cpu", "mem", "disk", "network", "thermal"].forEach(function(p){
				var q = p[0].toUpperCase() + p.substr(1);

				this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-" + p + "-graph", "panel" + q + "Graph", this.updatePanelWidgets.bind(this));
				this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-" + p + "-width", "panel" + q + "Width", this.updatePanelWidgets.bind(this));
			}, this);
			this.settingProvider.bindProperty(Settings.BindingDirection.IN, "panel-mem-mode", "panelMemMode", this.updatePanelWidgets.bind(this));

			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			this.modules = {
				cpu: new Modules.CPU(this.settings),
				mem: new Modules.Memory(this.settings),
				swap: new Modules.Swap(this.settings),
				disk: new Modules.Disk(this.settings),
				network: new Modules.Network(this.settings),
				thermal: new Modules.Thermal(this.settings)
			};

			for(i in this.modules)
				this.menu.addMenuItem(this.modules[i].submenu);

			this.modules.thermal.time = this.time;

			this.initPanelWidgets();
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

		this.graphs = [
			new Graph.Pie(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.Arc(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.CPUHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.MemorySwapHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.DiskHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.NetworkHistory(this.canvas, this.modules, this.time, this.settings, this.colors),
			new Graph.ThermalHistory(this.canvas, this.modules, this.time, this.settings, this.colors)
		];
	},

	initPanelWidgets: function(){
		this.set_applet_tooltip(_("System monitor"));

		let iconBox = new St.Bin();
		let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "system-status-icon"});
		iconBox.child = icon;
		this.actor.add(iconBox, {y_align: St.Align.MIDDLE, y_fill: false});

		this.panelWidgets = [];

		this.addPanelWidget([Graph.CPUBar, Graph.CPUHistory], "Cpu");
		this.addPanelWidget([Graph.MemoryBar, Graph.MemoryHistory, Graph.MemorySwapBar, Graph.MemorySwapHistory], "Mem");
		this.addPanelWidget([Graph.DiskBar, Graph.DiskHistory], "Disk");
		this.addPanelWidget([Graph.NetworkBar, Graph.NetworkHistory], "Network");
		this.addPanelWidget([Graph.ThermalBar, Graph.ThermalHistory], "Thermal");
	},
	addPanelWidget: function(graphs, name){
		let widget = new PanelWidget(this.panelHeight, this.modules, this.settings, this.colors, name);
		for(var i = 0, l = graphs.length; i < l; ++i)
			widget.addGraph(graphs[i]);
		this.panelWidgets.push(widget);
		widget.canvas.set
		this.actor.add(widget.canvas);
	},
	updatePanelWidgets: function(){
		for(var i = 0, l = this.panelWidgets.length; i < l; ++i)
			this.panelWidgets[i].update();
	},

	getData: function(){
		try {
			let time = GLib.get_monotonic_time() / 1e6;
			let delta = time - this.time[0];
			this.time[0] = time;

			for(var i in this.modules)
				this.modules[i].getData(delta);

			if(this.menu.isOpen) this.updateMenuItems();
			this.timeout = Mainloop.timeout_add(this.settings.interval, this.getData.bind(this));
		} catch(e){
			global.logError(e);
		}
	},
	paint: function(once){
		if(this.menu.isOpen)
			this.canvas.queue_repaint();

		for(var i = 0, l = this.panelWidgets.length; i < l; ++i){
			if(this.settings["panel" + this.panelWidgets[i].name + "Graph"] !== -1)
				this.panelWidgets[i].paint();
		}

		if(!once)
			this.paintTimeout = Mainloop.timeout_add(this.settings.graphInterval, this.paint.bind(this));
	},
	draw: function(){
		try {
			this.graphs[this.settings.graphType].draw();
		} catch(e){
			global.logError(e);
		}
	},
	updateMenuItems: function(){
		try {
			for(var i in this.modules)
				this.modules[i].updateMenuItems();
		} catch(e){
			global.logError(e);
		}
	},
	on_applet_clicked: function(){
		this.menu.toggle();
		if(this.menu.isOpen) this.updateMenuItems();
	},
	on_applet_removed_from_panel: function(){
		Mainloop.source_remove(this.timeout);
		Mainloop.source_remove(this.paintTimeout);
	},
	onSettingsChanged: function(){
		try {
			["thermal", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap"].forEach(function(p){
				let c = this.settings[p].split(","), i;
				for(i = 0; i < 3; ++i)
					c[i] = parseInt(c[i].match(/\d+/)) / 255; //rgba[0-255] -> rgb[0-1]
				this.colors[p] = c;
			}, this);
			this.canvas.set_height(this.settings.graphSize);

			for(var i in this.modules){
				if(this.modules[i].onSettingsChanged)
					this.modules[i].onSettingsChanged();
			}
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

			if(direction == Clutter.ScrollDirection.DOWN && this.settings.graphType < 6)
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
