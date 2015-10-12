const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");

function _(str){
    return Gettext.dgettext(uuid, str);
}

function bind(func, context){
    function callback(){
        try {
            return func.apply(context, arguments);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

// Polyfills for string methods

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
if(!String.prototype.startsWith){
  String.prototype.startsWith = function(searchString, position){
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if(!String.prototype.endsWith){
    String.prototype.endsWith = function(searchString, position){
        let subjectString = this.toString();
        if(typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length)
            position = subjectString.length;

        position -= searchString.length;
        let lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}
