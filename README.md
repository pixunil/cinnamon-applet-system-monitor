System Monitor Applet for Cinnamon

###Installation

####Dependencies
- Ubuntu: `gir1.2-gtop`
- Fedora: `libgtop2-devel`
- Arch: `libgtop`

Install the latest version via Cinnamon Applet Settings, or:

1. Download [`applet.js`](applet.js), [`modules.js`](modules.js), [`graph.js`](graph.js), [`terminal.js`](terminal.js), [`metadata.json`](metadata.json) and [`settings-schema.json`](settings-schema.json)
2. Create a new directory `~/.local/share/cinnamon/applets/system-monitor@pixunil`
3. Copy the files in this directory
4. Activate the applet in Cinnamon Settings


###Settings

- **Interval**: the interval the applet refreshes data in milliseconds
- **Bytes unit**: the bytes unit for memory, swap etc.
	* Bytes with binary prefix: B, KiB, MiB, GiB... (1024B = 1KiB)
	* Bytes with decimal prefix: B, KB, MB, GB... (1000B = 1KB)
- **Rates unit**: the rates unit for disk and network
- **Thermal unit**: the temperature unit: °C or °F
- **Maximal size**: the highest value of a byte or rate before the prefix is incremented
- **Order of Disk and Network items**: Write - Read versus Read - Write
- **Thermal calculation mode**: how the thermal value is calculated
	* Disabled: disables thermal submenu and thermal graphs
	* Maximum: the highest value
	* Average: the average value
	* Minimum: the minimum value
- **Type of graph**
	* None: no chart, also disables the graphs menu in the applet
	* Pie and Arc: a chart showing you the current status of cpu, memory, swap, disk and network rates and thermal value
	* History: a chart showing you only one modul, but as a history
- **Height of graph**: How big the chart is
- **Amount of history steps**: How many steps will be saved for history graphs
- **Appearance of history graphs**
	* Line: all points of a history are connected and stroked, the histories are combined
	* Area: all points of a history are connected and filled, the histories are separated
	* Bar: every point is represented by a bar, the histories are combined
- **Connection type for Line or Area**
	* Line: a normal line
	* Straight: a line like steps
	* Curve: a bézier curve
- **History graphs draw interval**: The interval, in which the history graphs refreshes
- The colors inputs: The colors, that are used by the graphs
