System Monitor Applet for Cinnamon

# Installation

### Dependency
You need the `GTop` bindings to use the modules CPU, Memory, Swap, Disk and Network.

- Ubuntu: `gir1.2-gtop`
- Fedora: `libgtop2-devel`
- Arch: `libgtop`

Install the latest version via Cinnamon Applet Settings, or:

1. Download all `.js` and `.json` files
2. Create a new directory `~/.local/share/cinnamon/applets/system-monitor@pixunil`
3. Copy the files in this directory
4. Activate the applet in Cinnamon Settings

# Modules
This applet offers information about five modules. These are:

- **Load averages** - Load averages of the last 1, 5 and 15 minutes
- **CPU** - multi-core CPU usage (total, user and system)
- **Memory and Swap** - usage of the Memory (used, cached and buffered) and of the Swap
- **Disk** - read / write and space usage of the disk
- **Network** - up / down usage and total traffic
- **Thermal** - temperature of some compenents
- **Fan** - fan rotations of some compenents

# FAQ

### I want to see the information also in the panel.
You can choose for every module a panel label and graph.
Go to settings and select in the ComboBox next to "Label in the panel" the information you want to see.
With the ComboBox "Graph in the panel" you can choose a graph.

### The Thermal and the Fan module is not working.
Both Thermal and Fan modules gets its information from the command `sensors`.
That is also the reason why they are called sensor modules sometimes.
If it doesn't show up, you should check by running the command and look after these in the output:

Thermal | Fan
--------|----
`--.-°C`| `--RPM`

# Settings

## General
**Show Icon** - Option to hide the icon

_Note:_ If you have no other panel widgets (like graphs or labels) you can not access the applet menu

**Interval** - Interval in which the applet refreshes data in milliseconds

**Bytes unit** - Unit for memory, swap, disk space usage and total network usage
* Bytes with binary prefix: B, KiB, MiB, GiB... (1024B = 1KiB)
* Bytes with decimal prefix: B, KB, MB, GB... (1000B = 1KB)

**Rate unit** - Unit for disk and network usage
* Bytes with binary prefix per second: B/s, KiB/s MiB/s GiB/s... (1024B/s = 1KiB/s)
* Bytes with decimal prefix per second: B/s, KB/s MB/s GB/s... (1000B/s = 1KB/s)
* Bits with binary prefix per second: bit/s, Kibit/s Mibit/s Gibit/s... (1024bit/s = 1Kibit/s, 8bit = 1B)
* Bits with decimal prefix per second: bit/s, Kbit/s Mbit/s Gbit/s... (1000bit/s = 1Kbit/s)

**Thermal unit** - Unit for thermal data
* °C: Celsius
* °F: Fahrenheit

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

**Label in the panel** - Text which is displayed in the panel
You should use [placeholders](#placeholders) to display data.

**Graph in the panel** - Which graph the applet should show directly in the panel
* None - No Graph
* Bar - Show the current usage
* History - Show the history

**Mode of Graph** - Whether to show swap usage also in graph - only for Memory and Swap

**Width of graph** - How big the panel graph is

### Warnings
The CPU and Thermal module also offers you warnings.
A warning triggers when a data value is over a trigger value for a specific time.

**Warnings** - With the checkbox you can enable or disbale the warnings

**Trigger value** - The trigger value
_Note_: the thermal unit is equal the unit you set before

**Time** - After how many intervals the warning is displayed

**Mode** - How it should warn - only for CPU
* Cores - warns if a core is over the trigger value
* Average - warns if the average value is over the trigger value

### Placeholders
All placeholders begin with `%` or `$` proceeded by a word (the main part).
Optional, it is continued with a second word (the sub part) separated by a `.`, and a format separated by a `#`.

`[%$]main(.sub)?(#format)?`

#### Load averages

**main**
* `load(digit)` - load average of the last minute (digit = `0`), 5 minutes (digit = `1`) or 15 minutes (digit = `2`)

#### CPU

**main**
* `avg` - average usage
* `core(digit)` - a specific core (digit starting from 1)

**sub**
* `total` _Default_
* `user`
* `total`

Usage in percent.

##### Examples
`%avg`
`%core1 %core2 %core3 %core4`
`%avg.system %avg.user %avg.total`

#### Memory

**main**
* `memory`
* `swap`

**sub**
* `used` _Default_
* `cached`
* `buffer`
* `total`

**format**
* `percent` - Usage in percent of the total value _Default_
* `size` - Usage in bytes

##### Examples
`%memory#size`
`%memory.cached`
`%swap`

#### Disk

**main**
* `write`
* `read`

Usage in rates.

#### Network

**main**
* `write`
* `read`

**format**
* `rate` - Usage in rates _Default_
* `total` - Total traffic in bytes

#### Thermal

**main**
* `value` - Thermal value specified in "Thermal mode"
* `sensor(digit)` - Temperature of a sensor

#### Fan

**main**
* `value` - Fan value specified in "Fan mode"
* `sensor(digit)` - Rotations of a sensor
