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

#### General
- **Interval**: the interval the applet refreshes data in milliseconds
- **Bytes unit**: the bytes unit for memory, swap etc.
	* Bytes with binary prefix: B, KiB, MiB, GiB... (1024B = 1KiB)
	* Bytes with decimal prefix: B, KB, MB, GB... (1000B = 1KB)
- **Rates unit**: the rates unit for disk and network
	* Bytes with binary prefix per second: B/s, KiB/s MiB/s GiB/s... (1024B/s = 1KiB/s)
	* Bytes with decimal prefix per second: B/s, KB/s MB/s GB/s... (1000B/s = 1KB/s)
	* Bits with binary prefix per second: bit/s, Kibit/s Mibit/s Gibit/s... (1024bit/s = 1Kibit/s)
	* Bits with decimal prefix per second: bit/s, Kbit/s Mbit/s Gbit/s... (1000bit/s = 1Kbit/s)
- **Thermal unit**: the temperature unit for thermal
	* °C: Celsius
	* °F: Fahrenheit
- **Maximal size**: the highest value of a byte or rate before the prefix is incremented
- **Order of Disk and Network items**
	* Read - Write / Down - Up: Display the data received first
	* Write - Read / Up - Down: Display the data send first
- **Thermal calculation mode**: how the thermal value is calculated
	* Disabled: disables thermal submenu and thermal graphs
	* Maximum: the highest value
	* Average: the average value
	* Minimum: the minimum value

===============
#### Graphs

- **Type of graph**
	* None: no chart, also disables the graphs menu in the applet
	* Overview: a chart showing you the current status of all modules
	* ... History: a chart showing you only one modul, but as a history
- **Height of graph**: How big the chart is
- **Amount of history steps**: How many steps will be saved for history graphs
- **Appearance of overview graphs**
	* Pie: every value is a full circle
	* Arc: every value is a half circle
- **Appearance of history graphs**
	* Line: all points of a history are connected and stroked, the histories are combined
	* Area: all points of a history are connected and filled, the histories are separated
	* Bar: every point is represented by a bar, the histories are combined
- **Connection type for Line or Area**
	* Line: a normal line
	* Straight: a line like steps
	* Curve: a bézier curve
- **History graphs draw interval**: The interval, in which the history graphs refreshes

===============
#### CPU

- **CPU _X_**: color for the CPU core _X_
- **Label in the Panel**
	* None: show nothing
	* Average: show average percentage
	* All cores: show the percentage of all cores
- **Graph in the panel**
	* None: show nothing
	* Bar: show bars representing the current usage for each core
	* History: show usage histories for each core
- **Width of graph**: the width of the graph
- **enable CPU warning**: show a notification if the usage is higher than a trigger value
- **Warning time**: in how many intervals the usage must be higher than the trigger value
- **Use average CPU usage**: if selected, the average CPU usage will be taken, if not, every core will be monitored
- **Warning CPU usage**: the trigger usage

===============
#### Memory and Swap

**Memory**: color for memory
**Swap**: color for swap
- **Label in the Panel**
	* None: show nothing
	* Percent: show usage percentage of memory
- **Graph in the panel**
	* None: show nothing
	* Bar: show bars representing the current usage
	* History: show usage histories
- **Mode of graph**
	* only Memory: show only information about memory
	* Memory and Swap: show information about both memory and swap
- **Width of graph**: the width of the graph

===============
#### Disk

**Write**: color for write activities
**Read**: color for read activities
- **Label in the Panel**
	* None: show nothing
	* Usage: show usage
- **Graph in the panel**
	* None: show nothing
	* Bar: show bars representing the current usage
	* History: show usage histories
- **Width of graph**: the width of the graph

===============
#### Network

**Up**: color for up (send) activities
**Down**: color for down (receive) activities
- **Label in the Panel**
	* None: show nothing
	* Usage: show usage
- **Graph in the panel**
	* None: show nothing
	* Bar: show bars representing the current usage
	* History: show usage histories
- **Width of graph**: the width of the graph

===============
#### Thermal

- **Thermal**: color for Thermal _Note_: if the thermal sensor is labelled with core_x_, the matching CPU color will be used
- **Label in the Panel**
	* None: show nothing
	* Temperature: show the temperature
- **Graph in the panel**
	* None: show nothing
	* Bar: show bars representing the current usage for each core
	* History: show usage histories for each core
- **Width of graph**: the width of the graph
- **enable thermal warning**: show a notification if the temperature is higher than a trigger value
- **Warning time**: in how many intervals the temperature must be higher than the trigger value
- **Warning temperature**: the trigger temperature
