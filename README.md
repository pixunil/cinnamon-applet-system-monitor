System Monitor Applet for Cinnamon

# Installation

### Dependency
You need the `GTop` bindings to use the modules CPU, Memory, Swap, Disk and Network.

- Ubuntu: `gir1.2-gtop`
- Fedora: `libgtop2-devel`
- Arch: `libgtop`

Install the latest version via Cinnamon Applet Settings, or:

1. Download [`applet.js`](applet.js), [`modules.js`](modules.js), [`graph.js`](graph.js), [`terminal.js`](terminal.js), [`metadata.json`](metadata.json) and [`settings-schema.json`](settings-schema.json)
2. Create a new directory `~/.local/share/cinnamon/applets/system-monitor@pixunil`
3. Copy the files in this directory
4. Activate the applet in Cinnamon Settings

# Modules
This applet offers information about five modules. These are:

- **CPU** - multi-core CPU usage (total, user and system)
- **Memory and Swap** - usage of the Memory (used, cached and buffered) and of the Swap
- **Disk** - read / write and space usage of the disk
- **Network** - up / down usage and total traffic
- **Thermal** - temperature of some compenents

The Thermal modules gets its information from the command `sensors`. If it doesn't show up, you should check by running the command and look if you see a line like `--.-°C`.

# Settings

## General
**Interval** - The interval the applet refreshes data in milliseconds

**Bytes unit** - The bytes unit for memory, swap, disk space usage and total network usage
* Bytes with binary prefix: B, KiB, MiB, GiB... (1024B = 1KiB)
* Bytes with decimal prefix: B, KB, MB, GB... (1000B = 1KB)
    
**Rate unit** - The rate unit for disk and network usage
* Bytes with binary prefix per second: B/s, KiB/s MiB/s GiB/s... (1024B/s = 1KiB/s)
* Bytes with decimal prefix per second: B/s, KB/s MB/s GB/s... (1000B/s = 1KB/s)
* Bits with binary prefix per second: bit/s, Kibit/s Mibit/s Gibit/s... (1024bit/s = 1Kibit/s, 8bit = 1B)
* Bits with decimal prefix per second: bit/s, Kbit/s Mbit/s Gbit/s... (1000bit/s = 1Kbit/s)
    
**Thermal unit** - the temperature unit for thermal
* °C: Celsius
* °F: Fahrenheit
    
**Maximal size** - the highest value of a byte or rate before the prefix is incremented

**Order of Disk and Network items**
* Read - Write / Down - Up: Display the data received first
* Write - Read / Up - Down: Display the data send first

## Graphs
**Type of graph** - The graph shown in the menu
* None: no chart, also disables the graphs menu in the applet
* Overview: a chart showing you the current status of all modules
* _..._ History: a chart showing you only one modul, but as a history

_Note:_ If the vailable module is deactivated, this setting will be set to "Overview"  
_Hint:_ You can change the type also by scrolling on the graph or by selecting it in the graphs submenu

**Height of graph** - How big the chart is in pixels

**Amount of history steps** - How many steps will be saved for history graphs

**Appearance of overview graph** - How the Overview graph looks
* Pie - every value is a full circle
* Arc - every value is a half circle
    
**Connection type for history graphs**
* Line - a normal line
* Straight - a line like steps
* Curve - a bézier curve
    
**History graphs draw interval** - The interval, in which the history graphs refreshes

## Modules

The following sections are each for every module.
They are layouted identically:

_**Module**_ - A checkbox with which you can enable or disable the module

_**Colors**_ - The color widgets let you set the color for the graphs

**Appearance of history graphs** - How history graphs of the module looks
* Line - all points of a history are connected and stroked, the histories are combined
* Area - all points of a history are connected and filled, the histories are separated
* Stack - all points of a history are connected and filled, the histories are stacked - only available for CPU
* Bar - every point is represented by a bar, the histories are combined - only available for CPU, Disk and Network

**Label in the panel** - Which information the applet should show directly in the panel

**Graph in the panel** - Which graph the applet should show directly in the panel
* None - No Graph
* Bar - Show the current usage
* History - Show the history

**Mode of Graph** - Wheter to show swap usage also in graph - only for Memory and Swap

**Width of graph** - How big the panel graph is

### Warnings
The CPU and Thermal module also offers you warnings

**Warnings** - With the checkbox you can enable or disbale the warnings

**Trigger value** - The trigger value  
_Note_: the thermal unit is equal the unit you set before

**Time** - After how many intervals the warning is displayed

**Mode** - How it should warn - only for CPU
* Cores - warns if a core is over the trigger value
* Average - warns if the average value is over the trigger value
