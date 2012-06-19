dependencies = {
    releaseDir: "../../release/",
    prefixes: [
	[ "dijit", "../dijit" ],
	[ "dojox", "../dojox" ],
	[ "dgrid", "../dgrid" ],
	[ "xstyle", "../xstyle" ],
	[ "put-selector", "../put-selector" ],
	[ "buildbotstats", "../buildbotstats" ]
    ],
    layers: [{
	name: "dojo.js",
	dependencies: [
	    "buildbotstats.PerSiteStats",
	    "buildbotstats.PerDayStats",
	    "buildbotstats.PerOwnerStats",
	    "dojo.parser",
	    "dijit.layout.TabContainer",
	    "dijit.layout.ContentPane"
	]
    }]
};
