#!/usr/bin/env python

import sys
import os
import json
import subprocess
from gi.repository import GLib
from argparse import ArgumentParser
from glob import glob
try:
    import polib
except:
    print """

    Module "polib" not available.

    Please install the package "python-polib" and try again

    """
    quit()

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home


def remove_empty_folders(path):
    if not os.path.isdir(path):
        return

    # remove empty subfolders
    files = os.listdir(path)
    if len(files):
        for f in files:
            fullpath = os.path.join(path, f)
            if os.path.isdir(fullpath):
                remove_empty_folders(fullpath)

    # if folder empty, delete it
    files = os.listdir(path)
    if len(files) == 0:
        print "Removing empty folder:", path
        os.rmdir(path)


class Main:
    def __init__(self):
        try:
            file = open(os.path.join(os.getcwd(), "metadata.json"), "r")
            raw = file.read()
            file.close()
            self.md = json.loads(raw)
        except Exception, detail:
            print "Failed to get metadata - missing, corrupt, or incomplete metadata.json file"
            print detail
            quit()

        self.potname = self.md["uuid"] + ".pot"

        parser = ArgumentParser()
        sub = parser.add_subparsers(dest = "action")
        subparser = sub.add_parser("makepot", help = "Create and update .pot file")
        subparser.add_argument("-u", "--update", action = "store_true", help = "Update all .po files")
        subparser = sub.add_parser("update", help = "Update all .po files")
        subparser = sub.add_parser("create", help = "Create a new .po file")
        subparser.add_argument("locale", help = "The locale for the .po file")
        sub.add_parser("install", help = "Compiles and installs all .po files")
        sub.add_parser("remove", help = "Removes all compiled .po files")

        args = parser.parse_args()

        if args.action == "create":
            self.create(args.locale)
        elif args.action == "makepot":
            self.makepot()
            if args.update:
                self.update()
        elif args.action == "update":
            self.update()
        elif args.action == "install":
            self.install()
        elif args.action == "remove":
            self.remove()

    def create(self, locale):
        options = {
            "input":  self.potname,
            "output": "po/%s.po" % locale,
            "locale": "%s_%s.UTF-8" % (locale, locale.upper())
        }
        self.call("msginit", options)

    def makepot(self):
        print "Running xgettext on JavaScript files..."
        try:
            data = {
                "language":         "JavaScript",
                "keyword":          "_",
                "output":           self.potname,
                "package-name":     self.md["uuid"],
                "package-version":  self.md["version"],
                "copyright-holder": ""
            }
            arguments = ["xgettext"]
            for flag, value in data.items():
                arguments.append("--%s=%s" % (flag, value))
            arguments += glob("*.js")

            subprocess.call(arguments)
        except OSError:
            print "xgettext not found, you may need to install the gettext package"
            quit()

        self.pot = polib.pofile(self.potname)

        print "Scanning settings-schema.json..."
        try:
            file = open("settings-schema.json", "r")
            raw = file.read()
            file.close()
            data = json.loads(raw)
        except Exception, detail:
            print "Failed to get settings schema - missing, corrupt, or incomplete settings-schema.json file"
            print detail
            quit()
        for key in data:
            self.extract_strings(data[key], key)

        self.pot.save()

        print "Extraction complete"

    def update(self):
        if not getattr(self, "pot", None):
            self.pot = polib.pofile(self.potname)

        for file in os.listdir("po"):
            po = polib.pofile(os.path.join("po", file))
            po.merge(self.pot)
            po.metadata["Project-Id-Version"] = self.pot.metadata["Project-Id-Version"]
            po.metadata["POT-Creation-Date"] = self.pot.metadata["POT-Creation-Date"]
            po.save()

        print "PO files updated"

    def extract_strings(self, data, parent):
        for key in data:
            if key in ("description", "tooltip", "units"):
                comment = "settings->%s->%s" % (parent, key)
                self.save_entry(data[key], comment)
            elif key in "options":
                for option in data[key]:
                    comment = "settings->%s->%s" % (parent, key)
                    self.save_entry(option, comment)

    def save_entry(self, msgid, comment):
        try:
            msgid = msgid.encode("ascii")
        except UnicodeEncodeError:
            return

        if not msgid.strip():
            return

        entry = self.pot.find(msgid)
        if entry:
            if comment not in entry.comment:
                if entry.comment:
                    entry.comment += "\n"
                entry.comment += comment
        else:
            entry = polib.POEntry(msgid = msgid, comment = comment)
            self.pot.append(entry)

    def install(self):
        done_one = False
        for file in os.listdir("po"):
            parts = os.path.splitext(file)
            if parts[1] == '.po':
                this_locale_dir = os.path.join(locale_inst, parts[0], 'LC_MESSAGES')
                GLib.mkdir_with_parents(this_locale_dir, 0755)
                arguments = (
                    "--check",
                    os.path.join("po", file),
                    "--output-file",
                    os.path.join(this_locale_dir, "%s.mo" % self.md["uuid"])
                )
                self.call("msgfmt", arguments = arguments)
                done_one = True
        if done_one:
            print "Install complete for domain %s" % self.md["uuid"]
        else:
            print "Nothing installed"

    def remove(self):
        done_one = False
        if os.path.exists(locale_inst):
            for i19_folder in os.listdir(locale_inst):
                if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % self.md["uuid"])):
                    done_one = True
                    os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', "%s.mo" % self.md["uuid"]))
                remove_empty_folders(os.path.join(locale_inst, i19_folder))
        if done_one:
            print "Removal complete for domain %s" % self.md["uuid"]
        else:
            print "Nothing to remove"

    def call(self, command, options = {}, arguments = ()):
        try:
            args = [command]
            for option, value in options.items():
                args.append("--%s=%s" % (option, value))
            args += arguments
            subprocess.call(args)
        except:
            print "ERROR: command %s not found" % command
            quit()

if __name__ == "__main__":
    Main()
