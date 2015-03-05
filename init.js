const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";
const appletDirectory = imports.ui.appletManager.applets[uuid];

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");
function _(str){
    return Gettext.dgettext(uuid, str);
}

function bind(func, context){
    function callback(){
        try {
            func.apply(context, arguments);
        } catch(e){
            global.logError(e);
        }
    }

    return callback;
}

function init(module){
    module = appletDirectory[module];
    module._ = _;
    module.bind = bind;
    module.iconName = iconName;
    module.appletDirectory = appletDirectory;
}
