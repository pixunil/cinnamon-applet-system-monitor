const Applet = imports.ui.applet;

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const NMClient = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
try {
	const GTop = imports.gi.GTop;
} catch (e){
	Util.spawnCommandLine("notify-send -i utilities-system-monitor 'Dependence missing' 'Please install the GTop package \n\
\tUbuntu: gir1.2-gtop-2.0\n\
\tFedora: libgtop2-devel\n\
\tArch: libgtop'");
}

function MyApplet(metadata, orientation, instanceId){
	this._init(metadata, orientation, instanceId);
}

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(metadata, orientation, instanceId){
		Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			let item, i, l, j, r, s, _appSys = Cinnamon.AppSystem.get_default();
			this.set_applet_icon_symbolic_name("utilities-system-monitor");
			this.set_applet_tooltip(_("System monitor"));

			this.settings = {};
			this.colors = {};
			this.notifications = {};
			this.settingProvider = new Settings.AppletSettings(this.settings, metadata.uuid, instanceId);
			["interval", "thermalmode", "width",
				"disk", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap",
				"cpuwarning", "cpuwarningtime", "cpuwarningmode", "cpuwarningvalue", "thermalwarning", "thermalwarningtime", "thermalwarningvalue"].forEach(function(p){
				this.settingProvider.bindProperty(Settings.BindingDirection.IN, p, p, Lang.bind(this, this.on_settings_changed));
			}, this);


   this.cpu = {
				gtop: new GTop.glibtop_cpu(),
				count: GTop.glibtop_get_sysinfo().ncpu,
				total: [],
				nice: [],
				user: [],
				system: [],
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("CPU")),
				container: [new St.BoxLayout()]
			};

   this.mem = {
				gtop: new GTop.glibtop_mem(),
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("Memory")),
				container: [new St.BoxLayout()]
			};

			this.swap = {
				gtop: new GTop.glibtop_swap(),
				submenu: new PopupMenu.PopupMenuItem(_("Swap")),
				container: [new St.BoxLayout()]
			};

			this.disk = {
				gtop: new GTop.glibtop_fsusage(),
				write: 0,
				read: 0,
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("Disk")),
				container: [new St.BoxLayout()]
			};

			this.thermal = {
				sensors: [],
				path: "",
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("Thermal")),
				container: [new St.BoxLayout()]
			};

			/*this.info = {
				gtop: new GTop.glibtop_sysinfo(),
				submenu: new PopupMenu.PopupSubMenuMenuItem(_("Information")),
				items: [],
				container: []
			};*/

			this.data = {
				time: 0,
				cpu: {
					usage: [],
					system: [],
					user: []
				},
				mem: {},
				swap: {},
				mounts: [],
				disk: {maxWrite: 1,	maxRead: 1},
				thermal: []
			};
			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.total.push(0);
				this.cpu.nice.push(0);
				this.cpu.user.push(0);
				this.cpu.container[0].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
			}
			this.cpu.container[0].set_margin_left(260 - this.cpu.count * 60);
			this.cpu.submenu.addActor(this.cpu.container[0]);
			r = ["User", "System"];
			for(i = 0, l = r.length; i < l; ++i){
				item = new PopupMenu.PopupMenuItem(_(r[i]));
				this.cpu.container.push(new St.BoxLayout({margin_left: 260 - this.cpu.count * 60}));
				for(j = 0; j < this.cpu.count; ++j)
					this.cpu.container[i + 1].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
				item.addActor(this.cpu.container[i + 1]);
				this.cpu.submenu.menu.addMenuItem(item);
			}
			this.menu.addMenuItem(this.cpu.submenu);

			this.mem.container[0].add_actor(new St.Label({text: "? MiB", width: 100, style: "text-align: right", margin_left: 100}));
			this.mem.container[0].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
			this.mem.submenu.addActor(this.mem.container[0]);
			r = ["used", "cached", "buffered"];
			for(i = 0, l = r.length; i < l; ++i){
				item = new PopupMenu.PopupMenuItem(_(r[i]));
				this.mem.container.push(new St.BoxLayout());
				this.mem.container[i + 1].add_actor(new St.Label({text: "? MiB", width: 100, style: "text-align: right", margin_left: 100}));
				this.mem.container[i + 1].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
				item.addActor(this.mem.container[i + 1]);
				this.mem.submenu.menu.addMenuItem(item);
			}
			this.menu.addMenuItem(this.mem.submenu);

			this.swap.container[0].add_actor(new St.Label({text: "? MiB", width: 100, style: "text-align: right", margin_left: 100}));
			this.swap.container[0].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
			this.swap.submenu.addActor(this.swap.container[0]);
			this.menu.addMenuItem(this.swap.submenu);

			this.disk.container[0].add_actor(new St.Label({text: "? MiB/s", width: 130, style: "text-align: right"}));
			this.disk.container[0].add_actor(new St.Label({text: "? MiB/s", width: 130, style: "text-align: right"}));
			this.disk.submenu.addActor(this.disk.container[0]);
			let mountFile = Cinnamon.get_file_contents_utf8_sync('/etc/mtab').split("\n");
			i = 0;
			for(let mountLine in mountFile){
				mount = mountFile[mountLine].split(" ");
				if(mount[0].indexOf("/dev/") == 0 && this.data.mounts.indexOf(mount[1]) < 0){
					GTop.glibtop_get_fsusage(this.disk.gtop, mount[1]);
					this.data.mounts.push({
						path: mount[1],
						size: this.disk.gtop.block_size,
						free: this.disk.gtop.bfree,
						blocks: this.disk.gtop.blocks
					});
					item = new PopupMenu.PopupMenuItem(mount[1]);
					this.disk.container.push(new St.BoxLayout());
					this.disk.container[i + 1].add_actor(new St.Label({text: "? GiB", width: 100, style: "text-align: right"}));
					this.disk.container[i + 1].add_actor(new St.Label({text: "? GiB", width: 100, style: "text-align: right"}));
					this.disk.container[i + 1].add_actor(new St.Label({text: "?%", width: 60, style: "text-align: right"}));
					item.addActor(this.disk.container[i + 1]);
					this.disk.submenu.menu.addMenuItem(item);
					++i;
				}
			}
			GTop.glibtop_get_fsusage(this.disk.gtop, "/");
			this.disk.size = this.disk.gtop.block_size / 1024 / 1024;
			this.data.disk.taken = (this.disk.gtop.blocks - this.disk.gtop.bfree) / this.disk.gtop.blocks;
			this.menu.addMenuItem(this.disk.submenu);

			this.network.container[0].add_actor(new St.Label({text: "? kB/s \u25B2", width: 130, style: "text-align: right"}));
			this.network.container[0].add_actor(new St.Label({text: "? kB/s \u25BC", width: 130, style: "text-align: right"}));
			this.network.submenu.addActor(this.network.container[0]);
			this.menu.addMenuItem(this.network.submenu);

			this.thermal.container[0].add_actor(new St.Label({text: "?\u00b0C", width: 80, style: "text-align: right", margin_left: 180}));
			this.thermal.submenu.addActor(this.thermal.container[0]);
			r = GLib.spawn_command_line_sync("which sensors");
			if(r[0] && r[3] == 0){
				this.thermal.path = r[1].toString().split("\n", 1)[0];
				r = GLib.spawn_command_line_sync(this.thermal.path)[1].toString().split("\n");
				for(i = 0, l = r.length; i < l; ++i){
					if(r[i].substr(0, 8) == "Adapter:"){
						if(s) this.thermal.submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
						s = r[i].substr(9);
						this.thermal.submenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(s));
						for(++i; r[i] && r[i].substr(0, 8) != "Adapter:"; ++i){
							item = new PopupMenu.PopupMenuItem(r[i].match(/[^:]+/)[0]);
							this.thermal.container.push(new St.BoxLayout());
							this.thermal.container[this.thermal.container.length - 1].add_actor(new St.Label({text: "?\u00b0C", width: 80, style: "text-align: right", margin_left: 180}));
							item.addActor(this.thermal.container[this.thermal.container.length - 1]);
							this.thermal.submenu.menu.addMenuItem(item);
							this.thermal.sensors.push(i);
						}
					}
				}
			}
			this.menu.addMenuItem(this.thermal.submenu);

			this.canvas = new St.DrawingArea({height: (this.cpu.count + 4) * this.settings.width * 2});
			this.canvas.connect('repaint', Lang.bind(this, this.draw));
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

			this.on_settings_changed();
			this.getData();

		} catch(e){
			global.logError(e);
		}
	},
	getData: function(){
		try {
			let i, l, r = 0;
			GTop.glibtop_get_cpu(this.cpu.gtop);
			for(i = 0; i < this.cpu.count; ++i){
				var dtotal = this.cpu.gtop.xcpu_total[i] - this.cpu.total[i];
				var dnice = this.cpu.gtop.xcpu_nice[i] - this.cpu.nice[i];
				var duser = this.cpu.gtop.xcpu_user[i] - this.cpu.user[i];
				var dsystem = this.cpu.gtop.xcpu_sys[i] - this.cpu.system[i];

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
			this.data.mem.used = Math.round(this.mem.gtop.used / 1024 / 1024);
			this.data.mem.buffer = Math.round(this.mem.gtop.buffer / 1024 / 1024);
			this.data.mem.cached = Math.round(this.mem.gtop.cached / 1024 / 1024);
			this.data.mem.usedup = this.data.mem.used - this.data.mem.buffer - this.data.mem.cached;

			GTop.glibtop_get_swap(this.swap.gtop);
			this.data.swap.total = Math.round(this.swap.gtop.total / 1024 / 1024);
			this.data.swap.used = Math.round(this.swap.gtop.used / 1024 / 1024);

			let write = 0, read = 0;
			for(i = 0; i < this.data.mounts.length; ++i){
				GTop.glibtop_get_fsusage(this.disk.gtop, this.data.mounts[i].path);
				write += this.disk.gtop.write;
				read += this.disk.gtop.read;
			}
			let time = GLib.get_monotonic_time() / 1000;
			let delta = (time - this.data.time) / 1000;
			if(delta > 0 && this.disk.write && this.disk.read){
				this.data.disk.write = (this.disk.size * (write - this.disk.write) / delta);
				this.data.disk.read = (this.disk.size * (read - this.disk.read) / delta);
			}
			this.disk.write = write;
			this.disk.read = read;

			if(this.data.disk.max < this.data.disk.write) this.data.disk.max = this.data.disk.write;
			if(this.data.disk.max < this.data.disk.read) this.data.disk.max = this.data.disk.read;

			r = GLib.spawn_command_line_sync(this.thermal.path)[1].toString().split("\n");
			this.data.thermal[0] = 0;
			for(i = 0, l = this.thermal.sensors.length; i < l; ++i){
				this.data.thermal[i + 1] = parseFloat(r[this.thermal.sensors[i]].match(/\d+\.\d+/));
				if(this.settings.thermalmode == 0 && this.data.thermal[0] > this.data.thermal[i + 1] || this.data.thermal[0] == 0) this.data.thermal[0] = this.data.thermal[i + 1];
				else if(this.settings.thermalmode == 1) this.data.thermal[0] += this.data.thermal[i + 1];
				else if(this.settings.thermalmode == 2 && this.data.thermal[0] < this.data.thermal[i + 1]) this.data.thermal[0] = this.data.thermal[i + 1];
			}
			if(this.settings.thermalmode == 1) this.data.thermal[0] /= l;

			this.data.time = time;
			if(this.menu.isOpen) this.refresh();
			Mainloop.timeout_add(this.settings.interval, Lang.bind(this, this.getData));
		} catch(e){
			global.logError(e);
		}
	},
	draw: function (){
		try {
			let ctx = this.canvas.get_context();
			let w = this.canvas.get_width();
			let h = this.canvas.get_height();

			let r = this.settings.width, a = -Math.PI / 2;
			function arc(angle, dir){
				if(dir) ctx.arc(w / 2, h / 2, r, a, a += angle);
				else ctx.arcNegative(w / 2, h / 2, r, a, a -= angle);
				ctx.stroke();
			}
			ctx.setLineWidth(this.settings.width);
			ctx.setSourceRGBA(this.colors["disk"][0], this.colors["disk"][1], this.colors["disk"][2], 1);
			ctx.moveTo(w / 2, h / 2);
			ctx.arcNegative(w / 2, h / 2, r, a, a - Math.PI * this.data.disk.taken * 2);
			ctx.moveTo(w / 2, h / 2);
			ctx.fill();
			r += this.settings.width / 2;

			a = -Math.PI;
			ctx.setSourceRGBA(this.colors["read"][0], this.colors["read"][1], this.colors["read"][2], 1);
			arc(Math.PI * this.data.disk.read / this.data.disk.max / 2, false);
			a = -Math.PI;
			ctx.setSourceRGBA(this.colors["write"][0], this.colors["write"][1], this.colors["write"][2], 1);
			arc(Math.PI * this.data.disk.write / this.data.disk.max / 2, true);
			r += this.settings.width;
			a = -Math.PI / 2;

			for(let i = 0; i < this.cpu.count; ++i){
				ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], 1);
				arc(Math.PI * this.data.cpu.user[i] * 2, true);
				ctx.setSourceRGBA(this.colors["cpu" + (i % 4 + 1)][0], this.colors["cpu" + (i % 4 + 1)][1], this.colors["cpu" + (i % 4 + 1)][2], .75);
				arc(Math.PI * this.data.cpu.system[i] * 2, true);
				r += this.settings.width;
				a = -Math.PI / 2;
			}

			ctx.setSourceRGBA(this.colors["mem"][0], this.colors["mem"][1], this.colors["mem"][2], 1);
			arc(Math.PI * this.data.mem.usedup / this.data.mem.total * 2, false);
			ctx.setSourceRGBA(this.colors["mem"][0], this.colors["mem"][1], this.colors["mem"][2], .75);
			arc(Math.PI * this.data.mem.cached / this.data.mem.total * 2, false);
			ctx.setSourceRGBA(this.colors["mem"][0], this.colors["mem"][1], this.colors["mem"][2], .5);
			arc(Math.PI * this.data.mem.buffer / this.data.mem.total * 2, false);
			r += this.settings.width;
			a = -Math.PI / 2;

			ctx.setSourceRGBA(this.colors["swap"][0], this.colors["swap"][1], this.colors["swap"][2], 1);
			arc(Math.PI * this.data.swap.used / this.data.swap.total * 2, false);
		} catch(e){
			global.logError(e);
		}
	},
	refresh: function (){
		try {
			let i, l;
			for(i = 0; i < this.cpu.count; ++i){
				this.cpu.container[0].get_children()[i].set_text((this.data.cpu.usage[i] * 100).toFixed(1) + "%");
				this.cpu.container[1].get_children()[i].set_text((this.data.cpu.user[i] * 100).toFixed(1) + "%");
				this.cpu.container[2].get_children()[i].set_text((this.data.cpu.system[i] * 100).toFixed(1) + "%");
			}

			this.mem.container[0].get_children()[0].set_text(this.data.mem.used + " MiB");
			this.mem.container[0].get_children()[1].set_text((100 * this.data.mem.used / this.data.mem.total).toFixed(1) + "%");
			this.mem.container[1].get_children()[0].set_text(this.data.mem.usedup + " MiB");
			this.mem.container[1].get_children()[1].set_text((100 * this.data.mem.usedup / this.data.mem.total).toFixed(1) + "%");
			this.mem.container[2].get_children()[0].set_text(this.data.mem.cached + " MiB");
			this.mem.container[2].get_children()[1].set_text((100 * this.data.mem.cached / this.data.mem.total).toFixed(1) + "%");
			this.mem.container[3].get_children()[0].set_text(this.data.mem.buffer + " MiB");
			this.mem.container[3].get_children()[1].set_text((100 * this.data.mem.buffer / this.data.mem.total).toFixed(1) + "%");

			this.swap.container[0].get_children()[0].set_text(this.data.swap.used + " MiB");
			this.swap.container[0].get_children()[1].set_text(Math.round(1000 * this.data.swap.used / this.data.swap.total) / 10 + "%");

			this.disk.container[0].get_children()[0].set_text(this.data.disk.write.toFixed(1) + " MiB/s \u25B2");
			this.disk.container[0].get_children()[1].set_text(this.data.disk.read.toFixed(1) + " MiB/s \u25BC");
			for(i = 0; i < this.data.mounts.length; ++i){
				this.disk.container[i + 1].get_children()[0].set_text(((this.data.mounts[i].blocks - this.data.mounts[i].free) * this.data.mounts[i].size / 1024 / 1024 / 1024).toFixed(1) + " GiB");
				this.disk.container[i + 1].get_children()[1].set_text((this.data.mounts[i].blocks * this.data.mounts[i].size / 1024 / 1024 / 1024).toFixed(1) + " GiB");
				this.disk.container[i + 1].get_children()[2].set_text(((this.data.mounts[i].blocks - this.data.mounts[i].free) * 100 / this.data.mounts[i].blocks).toFixed(1) + "%");
			}

			for(i = 0, l = this.data.thermal.length; i < l; ++i)
				this.thermal.container[i].get_children()[0].set_text(this.data.thermal[i].toFixed(1) + "\u00b0C");

			this.canvas.queue_repaint();
		} catch(e){
			global.logError(e);
		}
	},
	on_applet_clicked: function(event){
		this.menu.toggle();
		if(this.menu.isOpen) this.refresh();
	},
	on_settings_changed: function(){
		try {
			["disk", "write", "read", "cpu1", "cpu2", "cpu3", "cpu4", "mem", "swap"].forEach(function(p){
				let c = this.settings[p].split(","), i;
				for(i = 0; i < 3; ++i)
					c[i] = parseInt(c[i].match(/\d+/)) / 255; //rgba[0-255] -> rgb[0-1]
				this.colors[p] = c;
			}, this);
			this.canvas.set_height((this.cpu.count + 4) * this.settings.width * 2);
			this.canvas.set_height((this.cpu.count + 4) * this.settings.width * 2);
		} catch(e){
			global.logError(e);
		}
	}
};

function main(metadata, orientation, panelHeight, instanceId){
	let myApplet = new MyApplet(metadata, orientation, instanceId);
	return myApplet;
}
