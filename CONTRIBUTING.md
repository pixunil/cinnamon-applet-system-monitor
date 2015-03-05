## Reporting an Issue
If you want to report a bug or want to make a feature request, please do following:

1. Look if this is resolved in the latest [version](https://github.com/pixunil/cinnamon-applet-system-monitor/releases) or HEAD (see [Installation](https://github.com/pixunil/cinnamon-applet-system-monitor/blob/master/README.md#installation))
2. Look if it is already [reported](https://github.com/pixunil/cinnamon-applet-system-monitor/issues?q=is%3Aissue), else open a new one
3. If it is a bug, attach the contents of `~/.xsession-errors` and `~/.cinnamon/glass.log`, wrapped into [code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines)
4. Add a nice description

I will now look how I can solve this or how a new feature can be implemented.

## Translating

If you want to translate this applet in a new language or fix some translating issues, please do following:
(There is no need to use `locale-helper.py`, but I recommend it)

1. Fetch the latest code with `git pull`
2. Run `./locale-helper.py makepot -u` to update the `.pot` file and all `.po` files
3. _Only for new languages_: run `./locale-helper.py create <locale>` (`<locale>` is e.g. `de`, `fr`)
4. Edit the `.po` file in `po/` with a text editor or an application like poedit
5. Test your translation with `./locale-helper.py install` (you can undo it with `./locale-helper.py remove`)
6. Commit your `.po` file and make a PR

***

Thanks for your help!
