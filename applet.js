const Applet = imports.ui.applet;

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const NMClient = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const GTop = imports.gi.GTop;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

function MyApplet(metadata, orientation, instanceId){
	this._init(metadata, orientation, instanceId);
}

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(metadata, orientation, instanceId){
		let item, i, j, _appSys = Cinnamon.AppSystem.get_default();
		Applet.IconApplet.prototype._init.call(this, orientation);

		try {
		 this.set_applet_icon_symbolic_name("utilities-system-monitor");
   this.set_applet_tooltip(_("System monitor"));
   
   this.settings = {};
   this.settingProvider = new Settings.AppletSettings(this.settings, metadata.uuid, instanceId);
   this.settingProvider.bindProperty(Settings.BindingDirection.IN, "interval", "interval");
   
   this.cpu = {
				gtop: new GTop.glibtop_cpu(),
				count: GTop.glibtop_get_sysinfo().ncpu,
				colors: [[1, .43, 0], [.8, .05, .16], [.28, 0.66, .2], [.18, .49, .7]],//[1, .5, 0] Orange
				total: [],
				nice: [],
				user: [],
				system: [],
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("CPU")),
				items: [new PopupMenu.PopupMenuItem(_("User")), new PopupMenu.PopupMenuItem(_("System"))],
				container: [new St.BoxLayout()]
			};

   this.mem = {
				gtop: new GTop.glibtop_mem(),
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("Memory")),
				items: [new PopupMenu.PopupMenuItem(_("cached")), new PopupMenu.PopupMenuItem(_("buffered")), new PopupMenu.PopupMenuItem(_("free"))],
				container: [new St.BoxLayout()]
			};	
			this.data = {
				cpu: {
					usage: [],
					system: [],
					user: []
				},
				mem: {}
			};		
		 this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);
			
			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.total.push(0);
				this.cpu.nice.push(0);
				this.cpu.user.push(0);
				this.cpu.container[0].add_actor(new St.Label({text: "?%", width: 40, style: "text-align: right"}));
			}
   this.cpu.submenu.addActor(this.cpu.container[0]);
			for(i = 0; i < this.cpu.items.length; ++i){
				this.cpu.container.push(new St.BoxLayout());
				for(j = 0; j < this.cpu.count; ++j)
				 this.cpu.container[i + 1].add_actor(new St.Label({text: "?%", width: 40, style: "text-align: right"}));
				this.cpu.items[i].addActor(this.cpu.container[i + 1]);
			 this.cpu.submenu.menu.addMenuItem(this.cpu.items[i]);
			}
			this.menu.addMenuItem(this.cpu.submenu);

   this.mem.container[0].add_actor(new St.Label({text: "? MiB", width: 100, style: "text-align: right"}));
   this.mem.container[0].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
   this.mem.submenu.addActor(this.mem.container[0]);
   for(i = 0; i < this.mem.items.length; ++i){
				this.mem.container.push(new St.BoxLayout());
				this.mem.container[i + 1].add_actor(new St.Label({text: "? MiB", width: 100, style: "text-align: right"}));
				this.mem.container[i + 1].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
			 this.mem.items[i].addActor(this.mem.container[i + 1]);
			 this.mem.submenu.menu.addMenuItem(this.mem.items[i]);
			}
			this.menu.addMenuItem(this.mem.submenu);
			this.canvas = new St.DrawingArea();
			//this.canvas.connect('repaint', Lang.bind(this, this.draw));
   item = new PopupMenu.PopupBaseMenuItem({reactive: false});
		 item.addActor(this.canvas, {span: -1, expand: true});
		 this.menu.addMenuItem(item);
			
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			let _gsmApp = _appSys.lookup_app("gnome-system-monitor.desktop");
			item = new PopupMenu.PopupMenuItem(_("System Monitor"));
		 item.connect("activate", function (){
				_gsmApp.activate();
			});
			this.menu.addMenuItem(item);
			this.getData();
		} catch(e){
			global.logError(e);
		}
	},
	getData: function(){
  try {
   let i;
			GTop.glibtop_get_cpu(this.cpu.gtop);
			for(i = 0; i < this.cpu.count; ++i){
				var dtotal	= this.cpu.gtop.xcpu_total[i] - this.cpu.total[i];
				var dnice	= this.cpu.gtop.xcpu_nice[i] - this.cpu.nice[i];
				var duser	= this.cpu.gtop.xcpu_user[i] - this.cpu.user[i];
				var dsystem	= this.cpu.gtop.xcpu_sys[i] - this.cpu.system[i];
				
				this.cpu.total[i] = this.cpu.gtop.xcpu_total[i];
				this.cpu.nice[i] = this.cpu.gtop.xcpu_nice[i];
				this.cpu.user[i] = this.cpu.gtop.xcpu_user[i];
				this.cpu.system[i] = this.cpu.gtop.xcpu_sys[i];
				
				this.data.cpu.usage[i] = (duser + dnice + dsystem) / dtotal;
				this.data.cpu.user[i] = duser / dtotal;
				this.data.cpu.system[i] = dsystem / dtotal;
			}
			
			GTop.glibtop_get_mem(this.mem.gtop);
		 this.data.mem.total = Math.round(this.mem.gtop.total / 1024 / 1024);
		 this.data.mem.buffer = Math.round(this.mem.gtop.buffer / 1024 / 1024);
		 this.data.mem.cached = Math.round(this.mem.gtop.cached / 1024 / 1024);
		 this.data.mem.usedup = Math.round(this.mem.gtop.used / 1024 / 1024) - this.data.mem.buffer - this.data.mem.cached;
		} catch(e){
			global.logError(e);
		}
	},
	draw: function (){
		try {
			let ctx = this.canvas.get_context();
			let w = this.canvas.get_width();
			let h = this.canvas.get_height();
			
			let r = 10;
			ctx.setLineWidth(5);
			for(let i = 0, l = this.cpu.usage.length; i < l; ++i){
				ctx.setSourceRGBA(this.cpu.colors[i][0], this.cpu.colors[i][1], this.cpu.colors[i][2], 1);
				ctx.arc(w / 2, h / 2, r, -Math.PI / 2, Math.PI * this.cpu.usage[i] / 50 - Math.PI / 2);
				ctx.stroke();
			 r += 5; 
			}
	 } catch(e){
			global.logError(e);
		}
	},
 refresh: function (){
 	try {
			this.getData(); 
			for(var i = 0; i < this.cpu.count; ++i){
				this.cpu.container[0].get_children()[i].set_text(Math.round(this.data.cpu.usage[i] * 100) + "%");
				this.cpu.container[1].get_children()[i].set_text(Math.round(this.data.cpu.user[i] * 100) + "%");
				this.cpu.container[2].get_children()[i].set_text(Math.round(this.data.cpu.system[i] * 100) + "%");
   }
			this.mem.container[0].get_children()[0].set_text(this.data.mem.usedup + " MiB");
			this.mem.container[0].get_children()[1].set_text(Math.round(1000 * this.data.mem.usedup / this.data.mem.total) / 10 + "%");
   this.mem.container[1].get_children()[0].set_text(this.data.mem.buffer + " MiB");
			this.mem.container[1].get_children()[1].set_text(Math.round(1000 * this.data.mem.cached / this.data.mem.total) / 10 + "%");
   this.mem.container[2].get_children()[0].set_text(this.data.mem.cached + " MiB");
			this.mem.container[2].get_children()[1].set_text(Math.round(1000 * this.data.mem.buffer / this.data.mem.total) / 10 + "%");
   //this.canvas.queue_repaint();
			if(this.menu.isOpen) Mainloop.timeout_add(this.settings.interval,	Lang.bind(this, this.refresh));
		} catch(e){
			global.logError(e);
		}
	},
	on_applet_clicked: function(event){
		this.menu.toggle();
		if(this.menu.isOpen) this.refresh();
 }
};


function main(metadata, orientation, panelHeight, instanceId){
	let myApplet = new MyApplet(metadata, orientation, instanceId);
	return myApplet;
}
