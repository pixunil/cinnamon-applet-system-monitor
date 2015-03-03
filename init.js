const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";
const appletDirectory = imports.ui.appletManager.applets[uuid];

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
    module.bind = bind;
    module.iconName = iconName;
    module.appletDirectory = appletDirectory;
}
